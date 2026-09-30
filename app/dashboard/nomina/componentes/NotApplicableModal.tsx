"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleSlash } from "lucide-react";
import JustificationModalFrame, {
  JUSTIFICATION_FIELD_CLASSES,
  JUSTIFICATION_MAX_COMMENT_LENGTH,
} from "./JustificationModalFrame";
import type { IJustifiableDay, IJustificationSummaryItem, JustificationAction } from "./justificationTypes";

interface ButtonProps {
  day: IJustifiableDay;
  idPeriod: number;
  summaryItems: IJustificationSummaryItem[];
  /** Server action que marca el día como "No aplica" (`markAbsenceNotApplicable`, `markLatenessNotApplicable`). */
  action: JustificationAction;
  /** Texto de apoyo bajo el título del modal. */
  description: string;
  /** Error cuando el comentario va vacío. */
  emptyCommentMessage: string;
  /** Para el aria-label del botón: "Marcar como no aplica la falta de {empleado}". */
  ariaLabel: string;
}

interface ModalProps extends ButtonProps {
  onClose: () => void;
}

function NotApplicableModal({
  day,
  idPeriod,
  summaryItems,
  action,
  description,
  emptyCommentMessage,
  onClose,
}: ModalProps) {
  const router = useRouter();
  const [commentText, setCommentText] = useState(day.status === "not_applicable" ? (day.comentario ?? "") : "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveNotApplicable() {
    const comment = commentText.trim();
    if (!comment) {
      setErrorMessage(emptyCommentMessage);
      return;
    }
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const result = await action({
        id_period: idPeriod,
        id_empleado: day.id_empleado,
        fecha: day.fecha,
        comentario: comment,
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
      titleId="not-applicable-modal-title"
      title="Marcar como no aplica"
      icon={<CircleSlash size={18} />}
      employeeName={day.nombre_completo}
      summaryItems={summaryItems}
      isBusy={isSaving}
      onClose={onClose}
    >
      <p className="text-sm text-[#44474f] dark:text-zinc-400">{description}</p>

      {errorMessage && (
        <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
        Comentario
        <textarea
          rows={3}
          autoFocus
          maxLength={JUSTIFICATION_MAX_COMMENT_LENGTH}
          value={commentText}
          onChange={(event) => setCommentText(event.target.value)}
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
          onClick={saveNotApplicable}
          disabled={isSaving}
          className="rounded-lg bg-[#0051d5] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? "Guardando…" : "Marcar no aplica"}
        </button>
      </div>
    </JustificationModalFrame>
  );
}

/** Botón por fila: abre el modal para marcar el día como "No aplica" con un comentario obligatorio. */
export function MarkNotApplicableButton(props: ButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={props.ariaLabel}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-3 py-1.5 text-xs font-semibold text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
      >
        <CircleSlash size={14} aria-hidden />
        {props.day.status === "not_applicable" ? "Editar comentario" : "No aplica"}
      </button>
      {isOpen && <NotApplicableModal {...props} onClose={closeModal} />}
    </>
  );
}
