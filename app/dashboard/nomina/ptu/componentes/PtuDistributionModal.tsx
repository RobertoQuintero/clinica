"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, X } from "lucide-react";
import type { IPtuDistribution, PtuTaxpayerType, PtuThreeMonthsFactor } from "@/interfaces/payroll_ptu";
import { PTU_TAXPAYER_TYPE_LABELS, PTU_THREE_MONTHS_FACTORS } from "@/lib/payroll/constants";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { calculatePtuDistribution } from "@/lib/payroll/ptuDistribution";
import { addZeroToday } from "@/utils/date_helpper";
import { createPtuDistribution, updatePtuDistributionParameters } from "../actions";

type Props =
  | { mode: "create"; onClose: () => void }
  | { mode: "edit"; distribution: IPtuDistribution; onClose: () => void };

const FIELD_CLASSES =
  "w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all disabled:bg-[#eff4ff] dark:disabled:bg-zinc-800/60 disabled:text-[#44474f] dark:disabled:text-zinc-400 disabled:cursor-not-allowed";
const LABEL_CLASSES = "flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100";

const TAXPAYER_TYPES = Object.keys(PTU_TAXPAYER_TYPE_LABELS) as PtuTaxpayerType[];

/** Los dos criterios en uso para "3 meses de salario": 90 días o 365 ÷ 4 = 91.25. */
const THREE_MONTHS_FACTOR_LABELS: Record<PtuThreeMonthsFactor, string> = {
  90: "90 días (3 meses de 30 días)",
  91.25: "91.25 días (365 ÷ 4)",
};

/** Alta y edición de parámetros del reparto. El ejercicio solo se captura al crear. */
export default function PtuDistributionModal(props: Props) {
  const router = useRouter();
  const editedDistribution = props.mode === "edit" ? props.distribution : null;
  const { onClose } = props;

  const [fiscalYear, setFiscalYear] = useState(
    editedDistribution?.ejercicio.toString() ?? addZeroToday(new Date()).slice(0, 4),
  );
  const [taxpayerType, setTaxpayerType] = useState<PtuTaxpayerType>(editedDistribution?.tipo_persona ?? "M");
  const [taxableIncome, setTaxableIncome] = useState(editedDistribution?.renta_gravable.toString() ?? "");
  const [unclaimedPreviousPtu, setUnclaimedPreviousPtu] = useState(
    editedDistribution?.ptu_no_cobrada_anterior.toString() ?? "0",
  );
  const [threeMonthsFactor, setThreeMonthsFactor] = useState<PtuThreeMonthsFactor>(
    editedDistribution?.factor_tres_meses ?? 90,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  // Misma fórmula que el servidor, solo para mostrar el fondo antes de guardar.
  const fundPreview = calculatePtuDistribution(
    {
      renta_gravable: Number(taxableIncome) || 0,
      ptu_no_cobrada_anterior: Number(unclaimedPreviousPtu) || 0,
      factor_tres_meses: threeMonthsFactor,
    },
    [],
    new Map(),
  ).totals.fondo;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    const parameters = {
      tipo_persona: taxpayerType,
      renta_gravable: Number(taxableIncome),
      ptu_no_cobrada_anterior: Number(unclaimedPreviousPtu),
      factor_tres_meses: threeMonthsFactor,
    };
    try {
      const result = editedDistribution
        ? await updatePtuDistributionParameters({
            id_ptu_distribution: editedDistribution.id_ptu_distribution,
            ...parameters,
          })
        : await createPtuDistribution({ ejercicio: Number(fiscalYear), ...parameters });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al guardar el reparto");
    } finally {
      setIsSaving(false);
    }
  }

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
        aria-labelledby="ptu-distribution-modal-title"
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center">
              <HandCoins size={18} />
            </span>
            <h3 id="ptu-distribution-modal-title" className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
              {editedDistribution ? `Parámetros del reparto ${editedDistribution.ejercicio}` : "Nuevo reparto de PTU"}
            </h3>
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

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          {errorMessage && (
            <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={LABEL_CLASSES}>
              Ejercicio de las utilidades
              <input
                type="number"
                required
                min={2000}
                max={2100}
                step={1}
                disabled={Boolean(editedDistribution)}
                value={fiscalYear}
                onChange={(event) => setFiscalYear(event.target.value)}
                className={FIELD_CLASSES}
              />
            </label>
            <label className={LABEL_CLASSES}>
              Tipo de persona
              <select
                value={taxpayerType}
                onChange={(event) => setTaxpayerType(event.target.value as PtuTaxpayerType)}
                className={FIELD_CLASSES}
              >
                {TAXPAYER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {PTU_TAXPAYER_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL_CLASSES}>
              Renta gravable
              <input
                type="number"
                required
                min={0}
                step="0.01"
                inputMode="decimal"
                value={taxableIncome}
                onChange={(event) => setTaxableIncome(event.target.value)}
                className={FIELD_CLASSES}
              />
            </label>
            <label className={LABEL_CLASSES}>
              PTU no cobrada del ejercicio anterior
              <input
                type="number"
                required
                min={0}
                step="0.01"
                inputMode="decimal"
                value={unclaimedPreviousPtu}
                onChange={(event) => setUnclaimedPreviousPtu(event.target.value)}
                className={FIELD_CLASSES}
              />
            </label>
            <label className={`${LABEL_CLASSES} sm:col-span-2`}>
              Factor de 3 meses de salario
              <select
                value={threeMonthsFactor}
                onChange={(event) => setThreeMonthsFactor(Number(event.target.value) as PtuThreeMonthsFactor)}
                className={FIELD_CLASSES}
              >
                {PTU_THREE_MONTHS_FACTORS.map((factor) => (
                  <option key={factor} value={factor}>
                    {THREE_MONTHS_FACTOR_LABELS[factor]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-lg bg-[#eff4ff] dark:bg-zinc-800/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
              Fondo a repartir
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#0b1c30] dark:text-zinc-50">
              {formatPayrollCurrency(fundPreview)}
            </p>
            <p className="mt-1 text-xs text-[#747780] dark:text-zinc-500">
              10% de la renta gravable más la PTU no cobrada. La mitad se reparte por días trabajados y la otra
              mitad por salario.
            </p>
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
              {isSaving ? "Guardando…" : editedDistribution ? "Guardar cambios" : "Crear reparto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
