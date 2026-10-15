"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import JustificationModalFrame, {
  JUSTIFICATION_FIELD_CLASSES,
  JUSTIFICATION_MAX_COMMENT_LENGTH,
} from "@/app/dashboard/nomina/componentes/JustificationModalFrame";
import { cancelEconomicDay } from "../actions";

interface Props {
  id_economic_day: number;
  id_empleado: number;
  employeeName: string;
  /** Fecha ya formateada para mostrar, p. ej. "miércoles 21/10/2026". */
  dateLabel: string;
}

interface FormProps extends Props {
  onClose: () => void;
}

function CancelEconomicDayForm({
  id_economic_day,
  id_empleado,
  employeeName,
  dateLabel,
  onClose,
}: FormProps) {
  const router = useRouter();
  const [reasonText, setReasonText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function confirmCancellation() {
    const reason = reasonText.trim();
    if (!reason) {
      setErrorMessage("El motivo es obligatorio");
      return;
    }
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const result = await cancelEconomicDay({ id_economic_day, id_empleado, motivo: reason });
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
      titleId={`cancel-economic-day-modal-title-${id_economic_day}`}
      title="Cancelar día económico"
      icon={<Ban size={18} />}
      employeeName={employeeName}
      summaryItems={[{ label: "Día", value: dateLabel }]}
      isBusy={isSaving}
      onClose={onClose}
    >
      <p className="text-sm text-[#44474f] dark:text-zinc-400">
        El día queda cancelado y vuelve al saldo del año. Para cambiar la fecha, cancela este día y
        registra otro.
      </p>

      {errorMessage && (
        <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
        Motivo
        <textarea
          rows={3}
          autoFocus
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
          Volver
        </button>
        <button
          type="button"
          onClick={confirmCancellation}
          disabled={isSaving}
          className="rounded-lg bg-[#ba1a1a] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#ba1a1a]/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? "Guardando…" : "Cancelar día"}
        </button>
      </div>
    </JustificationModalFrame>
  );
}

/** Botón "Cancelar" de un día económico activo del año en curso y su modal con motivo obligatorio. */
export default function CancelEconomicDayModal(props: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#ba1a1a]/30 px-3 py-1.5 text-sm font-semibold text-[#ba1a1a] dark:text-red-400 dark:border-red-800 hover:bg-[#ba1a1a]/10 transition-colors"
      >
        <Ban size={14} aria-hidden />
        Cancelar
      </button>
      {isOpen && <CancelEconomicDayForm {...props} onClose={closeModal} />}
    </>
  );
}
