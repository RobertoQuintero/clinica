"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, ShieldCheck, TriangleAlert, X } from "lucide-react";
import type { IEmployeeSbc } from "@/interfaces/employee_sbc";
import type { ITaxParameter } from "@/interfaces/payroll_tax_parameters";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { resolveTaxParameter } from "@/lib/payroll/taxParameters";
import { addZeroToday } from "@/utils/date_helpper";
import { createEmployeeSbc, updateEmployeeSbc } from "../actions";

type MinimumWageRow = Pick<ITaxParameter, "clave" | "valor" | "vigente_desde">;

interface SharedProps {
  id_empleado: number;
  employeeName: string;
  hireDate: string;
  currentFiscalDailySalary: number | null;
  minimumWageRows: MinimumWageRow[];
}

interface ModalProps extends SharedProps {
  editedSbc?: IEmployeeSbc;
  onClose: () => void;
}

const FIELD_CLASSES =
  "w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all disabled:bg-[#eff4ff] dark:disabled:bg-zinc-800/60 disabled:text-[#747780] disabled:cursor-not-allowed";

function parseSbc(text: string): number | null {
  const trimmed = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const sbc = Number(trimmed);
  return sbc > 0 ? sbc : null;
}

/** Avisos ámbar que no bloquean el guardado: SBC por debajo del salario fiscal actual o del mínimo vigente a la fecha. */
function buildSbcWarnings(
  sbc: number | null,
  effectiveDate: string,
  currentFiscalDailySalary: number | null,
  minimumWageRows: MinimumWageRow[],
): string[] {
  if (sbc === null) return [];
  const warnings: string[] = [];
  if (currentFiscalDailySalary !== null && sbc < currentFiscalDailySalary) {
    warnings.push(
      `El SBC es menor que el salario diario fiscal actual del empleado (${formatPayrollCurrency(currentFiscalDailySalary)}).`,
    );
  }
  const minimumWage = effectiveDate
    ? resolveTaxParameter(minimumWageRows, "SALARIO_MINIMO_GENERAL", effectiveDate)
    : null;
  if (minimumWage !== null && sbc < minimumWage) {
    warnings.push(`El SBC es menor que el salario mínimo general vigente a esa fecha (${formatPayrollCurrency(minimumWage)}).`);
  }
  return warnings;
}

function EmployeeSbcModal({
  id_empleado,
  employeeName,
  hireDate,
  currentFiscalDailySalary,
  minimumWageRows,
  editedSbc,
  onClose,
}: ModalProps) {
  const router = useRouter();
  const isEditing = editedSbc !== undefined;

  const [sbcText, setSbcText] = useState(editedSbc ? String(editedSbc.sbc) : "");
  const [effectiveDate, setEffectiveDate] = useState(
    editedSbc ? editedSbc.vigente_desde.slice(0, 10) : addZeroToday(new Date()),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, isSaving]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const sbc = parseSbc(sbcText);
    if (sbc === null) {
      setErrorMessage("Captura un SBC mayor que cero con hasta dos decimales.");
      return;
    }
    if (!effectiveDate) {
      setErrorMessage("Indica desde qué fecha es vigente el SBC.");
      return;
    }
    if (!isEditing && effectiveDate < hireDate) {
      setErrorMessage("La vigencia no puede ser anterior a la fecha de ingreso del empleado.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result = isEditing
        ? await updateEmployeeSbc({ id_empleado, id_employee_sbc: editedSbc.id_employee_sbc, sbc })
        : await createEmployeeSbc({ id_empleado, sbc, vigente_desde: effectiveDate });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al guardar el SBC");
    } finally {
      setIsSaving(false);
    }
  }

  const warnings = buildSbcWarnings(parseSbc(sbcText), effectiveDate, currentFiscalDailySalary, minimumWageRows);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-sbc-modal-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 shrink-0 rounded-lg bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center">
              <ShieldCheck size={18} />
            </span>
            <div className="min-w-0">
              <h3 id="employee-sbc-modal-title" className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
                {isEditing ? "Editar SBC" : "Nuevo SBC"}
              </h3>
              <p className="text-sm text-[#44474f] dark:text-zinc-400 truncate">{employeeName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Cerrar"
            className="text-[#747780] hover:text-[#0b1c30] dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-60"
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

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
            Vigente desde
            <input
              type="date"
              required
              value={effectiveDate}
              min={hireDate}
              disabled={isEditing}
              onChange={(event) => setEffectiveDate(event.target.value)}
              className={`${FIELD_CLASSES} tabular-nums`}
            />
            <span className="text-xs font-normal text-[#747780] dark:text-zinc-500">
              Fecha del movimiento en IDSE. Para cambiarla, elimina este SBC y captura otro.
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
            SBC (pesos por día)
            <input
              type="text"
              inputMode="decimal"
              required
              autoFocus
              value={sbcText}
              onChange={(event) => setSbcText(event.target.value)}
              className={`${FIELD_CLASSES} tabular-nums`}
            />
          </label>

          {warnings.length > 0 && (
            <div
              role="status"
              className="flex gap-2 rounded-md bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
            >
              <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
              <ul className="flex flex-col gap-1">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
                <li>Puedes guardarlo de todos modos.</li>
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-[#0051d5] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? "Guardando…" : isEditing ? "Guardar cambios" : "Crear SBC"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function NewEmployeeSbcButton(props: SharedProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-[#0051d5] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90"
      >
        <Plus size={18} />
        Nuevo SBC
      </button>
      {isOpen && <EmployeeSbcModal {...props} onClose={closeModal} />}
    </>
  );
}

export function EditEmployeeSbcButton({ editedSbc, ...props }: SharedProps & { editedSbc: IEmployeeSbc }) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Editar SBC"
        aria-label={`Editar SBC vigente desde ${editedSbc.vigente_desde}`}
        className="p-1.5 rounded-lg text-[#44474f] dark:text-zinc-400 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
      >
        <Pencil size={16} />
      </button>
      {isOpen && <EmployeeSbcModal {...props} editedSbc={editedSbc} onClose={closeModal} />}
    </>
  );
}
