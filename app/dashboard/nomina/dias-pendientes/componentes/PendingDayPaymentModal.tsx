"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { CalendarPlus, Info, Plus, X } from "lucide-react";
import type { IPayrollPeriod } from "@/interfaces/payroll_period";
import type { IPendingDaysActiveEmployee } from "@/interfaces/payroll_pending_days";
import { PENDING_DAY_MOTIVE_MAX_LENGTH, PENDING_DAY_MOTIVE_MIN_LENGTH } from "@/lib/payroll/constants";
import { createPendingDayPayments } from "../actions";

type PeriodOption = Pick<IPayrollPeriod, "id_period" | "codigo" | "fecha_inicio" | "fecha_fin" | "status">;

interface ModalProps {
  idPeriod: number;
  periodFechaFin: string;
  periodOptions: PeriodOption[];
  activeEmployees: IPendingDaysActiveEmployee[];
  onClose: () => void;
}

const FIELD_CLASSES =
  "w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all";

const LABEL_CLASSES = "flex flex-col gap-1 text-xs font-semibold text-[#44474f] dark:text-zinc-300";

function employeeOptionLabel(employee: IPendingDaysActiveEmployee): string {
  return `${employee.nombre_completo} — ${employee.codigo_empleado}`;
}

/** Códigos de los periodos ya calculados (estatus 2, 3 o 4) cuyo rango se traslapa con [desde, hasta]. */
function findCalculatedPeriodCodes(periodOptions: PeriodOption[], fechaDesde: string, fechaHasta: string): string[] {
  if (!fechaDesde || !fechaHasta) return [];
  return periodOptions
    .filter((period) => period.status !== 1 && fechaDesde <= period.fecha_fin && fechaHasta >= period.fecha_inicio)
    .map((period) => period.codigo);
}

function PendingDayPaymentModal({ idPeriod, periodFechaFin, periodOptions, activeEmployees, onClose }: ModalProps) {
  const router = useRouter();
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<IPendingDaysActiveEmployee | null>(null);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [tarifaOperativaText, setTarifaOperativaText] = useState("0");
  const [tarifaFiscalText, setTarifaFiscalText] = useState("0");
  const [motivo, setMotivo] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const calculatedPeriodCodes = useMemo(
    () => findCalculatedPeriodCodes(periodOptions, fechaDesde, fechaHasta),
    [periodOptions, fechaDesde, fechaHasta],
  );

  function handleEmployeeSearchChange(value: string) {
    setEmployeeSearch(value);
    const found = activeEmployees.find((employee) => employeeOptionLabel(employee) === value);
    if (!found) {
      setSelectedEmployee(null);
      return;
    }
    setSelectedEmployee(found);
    setTarifaOperativaText(String(found.salario_diario));
    setTarifaFiscalText(String(found.salario_diario_fiscal));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    if (!selectedEmployee) {
      setErrorMessage("Selecciona un empleado de la lista");
      return;
    }
    if (!fechaDesde || !fechaHasta) {
      setErrorMessage("Captura la fecha inicial y la fecha final");
      return;
    }
    const tarifaOperativa = Number(tarifaOperativaText);
    const tarifaFiscal = Number(tarifaFiscalText);
    if (!Number.isFinite(tarifaOperativa) || !Number.isFinite(tarifaFiscal) || tarifaOperativa < 0 || tarifaFiscal < 0) {
      setErrorMessage("Las tarifas deben ser números mayores o iguales a 0");
      return;
    }
    if (tarifaOperativa === 0 && tarifaFiscal === 0) {
      setErrorMessage("Al menos una de las dos tarifas debe ser mayor que cero");
      return;
    }
    const trimmedMotivo = motivo.trim();
    if (trimmedMotivo.length < PENDING_DAY_MOTIVE_MIN_LENGTH) {
      setErrorMessage(`El motivo debe tener al menos ${PENDING_DAY_MOTIVE_MIN_LENGTH} caracteres`);
      return;
    }

    setIsSaving(true);
    try {
      const result = await createPendingDayPayments({
        id_period: idPeriod,
        id_empleado: selectedEmployee.id_empleado,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        tarifa_operativa: tarifaOperativa,
        tarifa_fiscal: tarifaFiscal,
        motivo: trimmedMotivo,
      });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al guardar la captura");
    } finally {
      setIsSaving(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-day-payment-modal-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center">
              <CalendarPlus size={18} />
            </span>
            <h3 id="pending-day-payment-modal-title" className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
              Capturar días pendientes de pago
            </h3>
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

        <form onSubmit={handleSubmit} noValidate className="p-6 flex flex-col gap-5">
          {errorMessage && (
            <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          )}

          <label className={LABEL_CLASSES}>
            Empleado
            <input
              list="pending-days-active-employees"
              value={employeeSearch}
              onChange={(event) => handleEmployeeSearchChange(event.target.value)}
              placeholder="Escribe un nombre o código…"
              autoComplete="off"
              autoFocus
              className={FIELD_CLASSES}
            />
            <datalist id="pending-days-active-employees">
              {activeEmployees.map((employee) => (
                <option key={employee.id_empleado} value={employeeOptionLabel(employee)} />
              ))}
            </datalist>
            {employeeSearch && !selectedEmployee && (
              <span className="text-xs text-amber-600 dark:text-amber-400">Selecciona un empleado de la lista</span>
            )}
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={LABEL_CLASSES}>
              Fecha inicial
              <input
                type="date"
                value={fechaDesde}
                min={selectedEmployee?.fecha_ingreso}
                max={periodFechaFin}
                onChange={(event) => setFechaDesde(event.target.value)}
                className={FIELD_CLASSES}
              />
            </label>
            <label className={LABEL_CLASSES}>
              Fecha final
              <input
                type="date"
                value={fechaHasta}
                min={selectedEmployee?.fecha_ingreso}
                max={periodFechaFin}
                onChange={(event) => setFechaHasta(event.target.value)}
                className={FIELD_CLASSES}
              />
            </label>
          </div>

          {calculatedPeriodCodes.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
              <Info size={16} className="mt-px shrink-0" aria-hidden />
              Esas fechas pertenecen a {calculatedPeriodCodes.join(", ")}, ya calculado. Se puede guardar: es justo lo
              que esta pantalla resuelve.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={LABEL_CLASSES}>
              Tarifa diaria operativa
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                value={tarifaOperativaText}
                onChange={(event) => setTarifaOperativaText(event.target.value)}
                className={FIELD_CLASSES}
              />
              {selectedEmployee && selectedEmployee.salario_diario <= 0 && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  El empleado no tiene salario operativo: esa nómina no pagará estos días.
                </span>
              )}
            </label>
            <label className={LABEL_CLASSES}>
              Tarifa diaria fiscal
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                value={tarifaFiscalText}
                onChange={(event) => setTarifaFiscalText(event.target.value)}
                className={FIELD_CLASSES}
              />
              {selectedEmployee && selectedEmployee.salario_diario_fiscal <= 0 && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  El empleado no tiene salario fiscal: esa nómina no pagará estos días.
                </span>
              )}
            </label>
          </div>

          <label className={LABEL_CLASSES}>
            Motivo
            <textarea
              rows={3}
              maxLength={PENDING_DAY_MOTIVE_MAX_LENGTH}
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              placeholder="Explica por qué se deben estos días…"
              className={`${FIELD_CLASSES} resize-none`}
            />
            <span className="self-end text-[11px] text-[#747780] dark:text-zinc-500">
              {motivo.trim().length}/{PENDING_DAY_MOTIVE_MAX_LENGTH}
            </span>
          </label>

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
              {isSaving ? "Guardando…" : "Guardar captura"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

/** Abre el modal de captura por rango. Oculto cuando el periodo no admite cambios (estatus 3 o 4). */
export default function CapturePendingDaysButton({
  idPeriod,
  periodFechaFin,
  periodOptions,
  activeEmployees,
}: Omit<ModalProps, "onClose">) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex shrink-0 items-center gap-2 rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90"
      >
        <Plus size={16} />
        Capturar días
      </button>
      {isOpen && (
        <PendingDayPaymentModal
          idPeriod={idPeriod}
          periodFechaFin={periodFechaFin}
          periodOptions={periodOptions}
          activeEmployees={activeEmployees}
          onClose={closeModal}
        />
      )}
    </>
  );
}
