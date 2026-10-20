"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import type { IPtuDistributionEmployee } from "@/interfaces/payroll_ptu";
import { updatePtuDistributionEmployee } from "../actions";

interface Props {
  idPtuDistribution: number;
  employee: IPtuDistributionEmployee;
  onClose: () => void;
}

const FIELD_CLASSES =
  "w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all";
const LABEL_CLASSES = "flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100";
const HINT_CLASSES = "text-xs font-normal text-[#747780] dark:text-zinc-500";

/** Edita los días, el salario y el salario diario tope de un trabajador; al guardar la fila queda marcada como editada. */
export default function PtuEmployeeEditModal({ idPtuDistribution, employee, onClose }: Props) {
  const router = useRouter();
  const [days, setDays] = useState(employee.dias.toString());
  const [salary, setSalary] = useState(employee.salario.toString());
  const [dailySalaryCap, setDailySalaryCap] = useState(employee.salario_diario_tope.toString());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result = await updatePtuDistributionEmployee({
        id_ptu_distribution: idPtuDistribution,
        id_empleado: employee.id_empleado,
        dias: Number(days),
        salario: Number(salary),
        salario_diario_tope: Number(dailySalaryCap),
      });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al guardar la fila");
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
        aria-labelledby="ptu-employee-edit-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center">
              <Pencil size={18} />
            </span>
            <div>
              <h3 id="ptu-employee-edit-title" className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
                Editar fila
              </h3>
              <p className="text-sm text-[#44474f] dark:text-zinc-400">{employee.nombre_completo}</p>
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

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {errorMessage && (
            <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          )}

          <label className={LABEL_CLASSES}>
            Días trabajados
            <input
              type="number"
              required
              min={0}
              max={366}
              step={1}
              value={days}
              onChange={(event) => setDays(event.target.value)}
              className={FIELD_CLASSES}
            />
            <span className={HINT_CLASSES}>
              Para incapacidades por maternidad o riesgo de trabajo, ajusta los días aquí. Con 0 días no entra al
              reparto.
            </span>
          </label>
          <label className={LABEL_CLASSES}>
            Salario del ejercicio
            <input
              type="number"
              required
              min={0}
              step="0.01"
              inputMode="decimal"
              value={salary}
              onChange={(event) => setSalary(event.target.value)}
              className={FIELD_CLASSES}
            />
            <span className={HINT_CLASSES}>Solo sueldo: sin horas extra, bonos, comisiones ni aguinaldo.</span>
          </label>
          <label className={LABEL_CLASSES}>
            Salario diario tope
            <input
              type="number"
              required
              min={0}
              step="0.01"
              inputMode="decimal"
              value={dailySalaryCap}
              onChange={(event) => setDailySalaryCap(event.target.value)}
              className={FIELD_CLASSES}
            />
            <span className={HINT_CLASSES}>
              Con él se calcula el tope de 3 meses y, entre los trabajadores normales, el tope del 120% de confianza.
            </span>
          </label>

          <p className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            Al guardar, la fila queda marcada como editada y «Precargar trabajadores» ya no la modifica.
          </p>

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
              {isSaving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
