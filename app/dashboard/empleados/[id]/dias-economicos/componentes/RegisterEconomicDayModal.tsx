"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, TriangleAlert } from "lucide-react";
import JustificationModalFrame, {
  JUSTIFICATION_FIELD_CLASSES,
  JUSTIFICATION_MAX_COMMENT_LENGTH,
} from "@/app/dashboard/nomina/componentes/JustificationModalFrame";
import { isWorkingDate } from "@/lib/economicDays/economicDayRules";
import { registerEconomicDay } from "../actions";

interface Props {
  id_empleado: number;
  employeeName: string;
  currentYear: number;
  availableDays: number;
  workingWeekdays: number[];
  /** Cuando es `true` el botón se muestra deshabilitado, con `disabledReason` como ayuda. */
  isDisabled: boolean;
  disabledReason?: string;
}

interface FormProps extends Omit<Props, "isDisabled" | "disabledReason"> {
  onClose: () => void;
}

function RegisterEconomicDayForm({
  id_empleado,
  employeeName,
  currentYear,
  availableDays,
  workingWeekdays,
  onClose,
}: FormProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isDateInCurrentYear = selectedDate.startsWith(`${currentYear}-`);
  const isNonWorkingDate =
    selectedDate !== "" && isDateInCurrentYear && !isWorkingDate(selectedDate, workingWeekdays);
  const canSave =
    selectedDate !== "" && isDateInCurrentYear && !isNonWorkingDate && reasonText.trim() !== "";

  async function saveEconomicDay() {
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const result = await registerEconomicDay({
        id_empleado,
        fecha: selectedDate,
        motivo: reasonText.trim(),
      });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al guardar");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <JustificationModalFrame
      titleId="register-economic-day-modal-title"
      title="Registrar día económico"
      icon={<CalendarPlus size={18} />}
      employeeName={employeeName}
      summaryItems={[
        { label: "Año", value: String(currentYear) },
        { label: "Disponibles", value: String(availableDays) },
      ]}
      isBusy={isSaving}
      onClose={onClose}
    >
      {errorMessage && (
        <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
        Fecha
        <input
          type="date"
          autoFocus
          min={`${currentYear}-01-01`}
          max={`${currentYear}-12-31`}
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          disabled={isSaving}
          className={JUSTIFICATION_FIELD_CLASSES}
        />
      </label>

      {isNonWorkingDate && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 px-4 py-2 text-sm text-amber-800 dark:text-amber-300"
        >
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          Esa fecha no es un día laborable del empleado; no se puede registrar.
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
        Motivo
        <textarea
          rows={3}
          maxLength={JUSTIFICATION_MAX_COMMENT_LENGTH}
          value={reasonText}
          onChange={(event) => setReasonText(event.target.value)}
          disabled={isSaving}
          className={`${JUSTIFICATION_FIELD_CLASSES} resize-none`}
        />
      </label>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-5 py-2.5 text-sm font-semibold text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={saveEconomicDay}
          disabled={isSaving || !canSave}
          className="rounded-lg bg-[#0051d5] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? "Guardando…" : "Registrar"}
        </button>
      </div>
    </JustificationModalFrame>
  );
}

/** Botón "Registrar día económico" y su modal (fecha del año en curso + motivo obligatorio). */
export default function RegisterEconomicDayModal({ isDisabled, disabledReason, ...formProps }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={isDisabled}
        title={isDisabled ? disabledReason : undefined}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <CalendarPlus size={16} aria-hidden />
        Registrar día económico
      </button>
      {isOpen && <RegisterEconomicDayForm {...formProps} onClose={closeModal} />}
    </>
  );
}
