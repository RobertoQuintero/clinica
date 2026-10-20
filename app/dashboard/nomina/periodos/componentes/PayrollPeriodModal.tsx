"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, TriangleAlert, X } from "lucide-react";
import type { IPayrollPeriodDates, IPayrollPeriodRow, PayrollPeriodType } from "@/interfaces/payroll_period";
import { CHRISTMAS_BONUS_DEADLINE_MONTH_DAY, PAYROLL_PERIOD_TYPE_LABELS } from "@/lib/payroll/constants";
import { addZeroToday } from "@/utils/date_helpper";
import {
  createPayrollPeriod,
  getSuggestedPeriodDates,
  updatePayrollPeriod,
  type IPayrollFrequency,
} from "../actions";

type Props =
  | { mode: "create"; frequencies: IPayrollFrequency[]; onClose: () => void }
  | { mode: "edit"; period: IPayrollPeriodRow; onClose: () => void };

const EMPTY_DATES: IPayrollPeriodDates = { fecha_inicio: "", fecha_fin: "", fecha_corte: "", fecha_pago: "" };

const FIELD_CLASSES =
  "w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all disabled:bg-[#eff4ff] dark:disabled:bg-zinc-800/60 disabled:text-[#44474f] dark:disabled:text-zinc-400 disabled:cursor-not-allowed";

const PERIOD_TYPES: PayrollPeriodType[] = ["O", "E"];

/** Fechas del periodo extraordinario de un año: inicio y fin fijos; corte y pago el 20-dic (editables). */
function buildExtraordinaryDates(year: string): IPayrollPeriodDates {
  const suggestedPaymentDate = `${year}-${CHRISTMAS_BONUS_DEADLINE_MONTH_DAY}`;
  return {
    fecha_inicio: `${year}-01-01`,
    fecha_fin: `${year}-12-31`,
    fecha_corte: suggestedPaymentDate,
    fecha_pago: suggestedPaymentDate,
  };
}

const DATE_FIELDS: { key: keyof IPayrollPeriodDates; label: string }[] = [
  { key: "fecha_inicio", label: "Inicio" },
  { key: "fecha_fin", label: "Fin" },
  { key: "fecha_corte", label: "Corte de asistencias" },
  { key: "fecha_pago", label: "Pago" },
];

export default function PayrollPeriodModal(props: Props) {
  const router = useRouter();
  const isEditing = props.mode === "edit";
  const editedPeriod = props.mode === "edit" ? props.period : null;

  const [periodType, setPeriodType] = useState<PayrollPeriodType>(editedPeriod?.tipo_periodo ?? "O");
  const [bonusYear, setBonusYear] = useState(() => editedPeriod?.ejercicio.toString() ?? addZeroToday(new Date()).slice(0, 4));
  const isExtraordinary = periodType === "E";
  const [idPaymentPeriod, setIdPaymentPeriod] = useState("");
  const [dates, setDates] = useState<IPayrollPeriodDates>(
    editedPeriod
      ? {
          fecha_inicio: editedPeriod.fecha_inicio.slice(0, 10),
          fecha_fin: editedPeriod.fecha_fin.slice(0, 10),
          fecha_corte: editedPeriod.fecha_corte.slice(0, 10),
          fecha_pago: editedPeriod.fecha_pago.slice(0, 10),
        }
      : EMPTY_DATES,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const latestSuggestionRequest = useRef(0);

  const { onClose } = props;
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function handleFrequencyChange(nextFrequencyId: string) {
    setIdPaymentPeriod(nextFrequencyId);
    setErrorMessage(null);
    if (!nextFrequencyId) return;

    const requestId = ++latestSuggestionRequest.current;
    setIsSuggesting(true);
    const result = await getSuggestedPeriodDates(Number(nextFrequencyId));
    if (requestId !== latestSuggestionRequest.current) return;
    setIsSuggesting(false);

    if (result.ok) setDates(result.data);
    else setErrorMessage(result.message);
  }

  function handlePeriodTypeChange(nextType: PayrollPeriodType) {
    if (nextType === periodType) return;
    latestSuggestionRequest.current++;
    setIsSuggesting(false);
    setPeriodType(nextType);
    setErrorMessage(null);
    setIdPaymentPeriod("");
    setDates(nextType === "E" ? buildExtraordinaryDates(bonusYear) : EMPTY_DATES);
  }

  function handleBonusYearChange(nextYear: string) {
    setBonusYear(nextYear);
    if (/^d{4}$/.test(nextYear)) setDates(buildExtraordinaryDates(nextYear));
  }

  function handleDateChange(field: keyof IPayrollPeriodDates, value: string) {
    setDates((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isEditing && !isExtraordinary && !idPaymentPeriod) {
      setErrorMessage("Selecciona una frecuencia");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result = editedPeriod
        ? await updatePayrollPeriod(
            isExtraordinary
              ? { tipo_periodo: "E", concepto_extraordinario: "A", id_period: editedPeriod.id_period, fecha_corte: dates.fecha_corte, fecha_pago: dates.fecha_pago }
              : { tipo_periodo: "O", id_period: editedPeriod.id_period, ...dates },
          )
        : await createPayrollPeriod(
            isExtraordinary
              ? { tipo_periodo: "E", concepto_extraordinario: "A", ejercicio: Number(bonusYear), fecha_corte: dates.fecha_corte, fecha_pago: dates.fecha_pago }
              : { tipo_periodo: "O", id_payment_period: Number(idPaymentPeriod), ...dates },
          );
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al guardar el periodo");
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
        aria-labelledby="payroll-period-modal-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center">
              <CalendarRange size={18} />
            </span>
            <h3 id="payroll-period-modal-title" className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
              {isEditing ? "Editar fechas del periodo" : "Nuevo periodo de nómina"}
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

          {!isEditing && (
            <div
              role="radiogroup"
              aria-label="Tipo de periodo"
              className="inline-flex w-fit rounded-lg border border-[#c4c6d0] dark:border-zinc-700 bg-[#eff4ff] dark:bg-zinc-800 p-1"
            >
              {PERIOD_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={type === periodType}
                  onClick={() => handlePeriodTypeChange(type)}
                  className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
                    type === periodType
                      ? "bg-white dark:bg-zinc-900 text-[#0051d5] dark:text-blue-300 shadow-sm"
                      : "text-[#44474f] dark:text-zinc-400 hover:text-[#0b1c30] dark:hover:text-zinc-100"
                  }`}
                >
                  {PAYROLL_PERIOD_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
              {isExtraordinary ? "Año del aguinaldo" : "Frecuencia"}
              {editedPeriod ? (
                <input
                  type="text"
                  disabled
                  value={isExtraordinary ? editedPeriod.ejercicio : editedPeriod.frecuencia_descripcion}
                  className={FIELD_CLASSES}
                />
              ) : isExtraordinary ? (
                <input
                  type="number"
                  required
                  min={2000}
                  max={2100}
                  step={1}
                  value={bonusYear}
                  onChange={(event) => handleBonusYearChange(event.target.value)}
                  className={FIELD_CLASSES}
                />
              ) : (
                <select
                  value={idPaymentPeriod}
                  onChange={(event) => handleFrequencyChange(event.target.value)}
                  className={FIELD_CLASSES}
                >
                  <option value="">Selecciona una frecuencia</option>
                  {props.mode === "create" &&
                    props.frequencies.map((frequency) => (
                      <option key={frequency.id_payment_period} value={frequency.id_payment_period}>
                        {frequency.description}
                      </option>
                    ))}
                </select>
              )}
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
              Código
              <input
                type="text"
                disabled
                value={editedPeriod ? editedPeriod.codigo : "Se asignará al guardar"}
                className={FIELD_CLASSES}
              />
            </label>
          </div>

          <fieldset className="rounded-lg bg-[#eff4ff] dark:bg-zinc-800/60 p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
              Calendario del periodo
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
              {DATE_FIELDS.map((field) => (
                <label
                  key={field.key}
                  className="flex flex-col gap-1.5 text-xs font-semibold text-[#44474f] dark:text-zinc-300"
                >
                  {field.label}
                  <input
                    type="date"
                    required
                    value={dates[field.key]}
                    disabled={isExtraordinary && (field.key === "fecha_inicio" || field.key === "fecha_fin")}
                    onChange={(event) => handleDateChange(field.key, event.target.value)}
                    className={FIELD_CLASSES}
                  />
                </label>
              ))}
            </div>
            {isExtraordinary && dates.fecha_pago > `${bonusYear}-${CHRISTMAS_BONUS_DEADLINE_MONTH_DAY}` && (
              <p
                role="status"
                className="mt-3 flex gap-2 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
              >
                <TriangleAlert size={14} aria-hidden className="mt-0.5 shrink-0" />
                El aguinaldo debe pagarse a más tardar el 20 de diciembre. Puedes guardar esta fecha, pero el pago
                quedaría fuera de plazo.
              </p>
            )}
            <p className="mt-3 text-xs text-[#747780] dark:text-zinc-500">
              {isExtraordinary
                ? "Cubre del 1 de enero al 31 de diciembre del año. Solo se editan el corte y el pago."
                : isEditing
                ? "Solo se pueden cambiar las fechas mientras el periodo está Programada."
                : isSuggesting
                  ? "Calculando fechas sugeridas…"
                  : "Al elegir la frecuencia se sugieren las fechas; puedes ajustarlas antes de guardar."}
            </p>
          </fieldset>

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
              disabled={isSaving || isSuggesting}
              className="rounded-lg bg-[#0051d5] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? "Guardando…" : isEditing ? "Guardar cambios" : "Crear periodo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
