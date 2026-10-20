"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, X } from "lucide-react";
import { useActionData } from "@/hooks/useActionData";
import type { IPtuHistoryYear } from "@/interfaces/payroll_ptu";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { averagePtuHistory } from "@/lib/payroll/ptuDistribution";
import { getPtuHistory, savePtuHistory } from "../actions";

interface Props {
  idPtuDistribution: number;
  idEmployee: number;
  employeeName: string;
  onClose: () => void;
}

const FIELD_CLASSES =
  "w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm tabular-nums text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all";

/** Convierte el texto de un campo en importe; vacío (o no numérico) significa "sin dato". */
function parseAmountInput(text: string): number | null {
  if (text.trim() === "") return null;
  const amount = Number(text);
  return Number.isFinite(amount) ? amount : null;
}

function HistoryForm({
  idPtuDistribution,
  idEmployee,
  years,
  onClose,
}: {
  idPtuDistribution: number;
  idEmployee: number;
  years: IPtuHistoryYear[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [amountTextByYear, setAmountTextByYear] = useState<Record<number, string>>(() =>
    Object.fromEntries(years.map((year) => [year.ejercicio, year.importe === null ? "" : String(year.importe)])),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Mismo promedio que usa el servidor: divide entre los años con dato.
  const yearlyAmounts = years.flatMap((year) => {
    const amount = year.closedDistribution ? year.importe : parseAmountInput(amountTextByYear[year.ejercicio] ?? "");
    return amount === null ? [] : [amount];
  });
  const average = averagePtuHistory(yearlyAmounts);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const changedYears = years.filter(
        (year) =>
          !year.closedDistribution &&
          parseAmountInput(amountTextByYear[year.ejercicio] ?? "") !== year.importe,
      );
      for (const year of changedYears) {
        const result = await savePtuHistory({
          id_ptu_distribution: idPtuDistribution,
          id_empleado: idEmployee,
          ejercicio: year.ejercicio,
          importe: parseAmountInput(amountTextByYear[year.ejercicio] ?? ""),
        });
        if (!result.ok) {
          setErrorMessage(result.message);
          router.refresh();
          return;
        }
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al guardar el historial");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
      {errorMessage && (
        <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <p className="text-sm text-[#44474f] dark:text-zinc-400">
        La PTU que cobró en cada uno de los tres ejercicios anteriores. El tope del reparto es el mayor entre 3 meses de
        salario y el promedio de estos años (LFT art. 127 fr. VIII). Deja vacío el año sin dato.
      </p>

      <ul className="flex flex-col gap-3">
        {years.map((year) => (
          <li key={year.ejercicio} className="grid grid-cols-[5rem_1fr] items-center gap-3">
            <label htmlFor={`ptu-history-${year.ejercicio}`} className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
              {year.ejercicio}
            </label>
            {year.closedDistribution ? (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-[#eff4ff] dark:bg-zinc-800/60 px-3 py-2">
                <span id={`ptu-history-${year.ejercicio}`} className="text-sm tabular-nums text-[#0b1c30] dark:text-zinc-100">
                  {year.importe === null ? "Sin renglón en ese reparto" : formatPayrollCurrency(year.importe)}
                </span>
                <span className="text-xs font-semibold text-[#009c6b] dark:text-emerald-400">Reparto cerrado</span>
              </div>
            ) : (
              <input
                id={`ptu-history-${year.ejercicio}`}
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="Sin dato"
                value={amountTextByYear[year.ejercicio] ?? ""}
                onChange={(event) =>
                  setAmountTextByYear((previous) => ({ ...previous, [year.ejercicio]: event.target.value }))
                }
                className={FIELD_CLASSES}
              />
            )}
          </li>
        ))}
      </ul>

      <div className="rounded-lg bg-[#eff4ff] dark:bg-zinc-800/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
          Promedio de años con dato
        </p>
        {average ? (
          <p className="mt-1 text-xl font-bold tabular-nums text-[#0b1c30] dark:text-zinc-50">
            {formatPayrollCurrency(average.average)}
            <span className="ml-2 text-sm font-normal text-[#44474f] dark:text-zinc-400">
              {average.years === 1 ? "1 año" : `${average.years} años`}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-[#44474f] dark:text-zinc-400">
            Sin datos: solo aplica el tope de 3 meses de salario.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-[#0051d5] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? "Guardando…" : "Guardar historial"}
        </button>
      </div>
    </form>
  );
}

/** PTU de los tres ejercicios anteriores de un trabajador. Los años con reparto cerrado son de solo lectura. */
export default function PtuHistoryModal({ idPtuDistribution, idEmployee, employeeName, onClose }: Props) {
  const { data: years, loading, error } = useActionData([idPtuDistribution, idEmployee], () =>
    getPtuHistory({ id_ptu_distribution: idPtuDistribution, id_empleado: idEmployee }),
  );

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ptu-history-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center">
              <History size={18} />
            </span>
            <div>
              <h3 id="ptu-history-title" className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
                PTU de años anteriores
              </h3>
              <p className="text-sm text-[#44474f] dark:text-zinc-400">{employeeName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-[#747780] hover:text-[#0b1c30] dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <p className="px-6 py-10 text-center text-sm text-[#747780] dark:text-zinc-500">Cargando historial…</p>
        ) : error || !years ? (
          <p role="alert" className="px-6 py-10 text-center text-sm text-[#ba1a1a] dark:text-red-400">
            {error ?? "No se pudo cargar el historial"}
          </p>
        ) : (
          <HistoryForm idPtuDistribution={idPtuDistribution} idEmployee={idEmployee} years={years} onClose={onClose} />
        )}
      </div>
    </div>
  );
}
