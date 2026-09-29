"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleSlash } from "lucide-react";
import type { IAbsenceDayRow } from "@/interfaces/payroll_absence";
import { markAbsenceNotApplicable } from "../actions";
import AbsenceModalFrame, { ABSENCE_FIELD_CLASSES, ABSENCE_MAX_COMMENT_LENGTH } from "./AbsenceModalFrame";

interface ModalProps {
  dayRow: IAbsenceDayRow;
  idPeriod: number;
  onClose: () => void;
}

function AbsenceNotApplicableModal({ dayRow, idPeriod, onClose }: ModalProps) {
  const router = useRouter();
  const [commentText, setCommentText] = useState(dayRow.status === "not_applicable" ? (dayRow.comentario ?? "") : "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveNotApplicable() {
    const comment = commentText.trim();
    if (!comment) {
      setErrorMessage("Escribe por qué no aplica esta falta (festivo, vacaciones, checador sin conexión…).");
      return;
    }
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const result = await markAbsenceNotApplicable({
        id_period: idPeriod,
        id_empleado: dayRow.id_empleado,
        fecha: dayRow.fecha,
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
    <AbsenceModalFrame
      titleId="absence-not-applicable-modal-title"
      title="Marcar como no aplica"
      icon={<CircleSlash size={18} />}
      dayRow={dayRow}
      isBusy={isSaving}
      onClose={onClose}
    >
      <p className="text-sm text-[#44474f] dark:text-zinc-400">
        Una falta que no aplica no se descuenta de la nómina. El comentario queda como constancia.
      </p>

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
          maxLength={ABSENCE_MAX_COMMENT_LENGTH}
          value={commentText}
          onChange={(event) => setCommentText(event.target.value)}
          disabled={isSaving}
          className={`${ABSENCE_FIELD_CLASSES} resize-none`}
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
    </AbsenceModalFrame>
  );
}

interface ButtonProps {
  dayRow: IAbsenceDayRow;
  idPeriod: number;
}

/** Botón por fila: abre el modal para marcar la falta como "No aplica" con un comentario obligatorio. */
export function MarkAbsenceNotApplicableButton({ dayRow, idPeriod }: ButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Marcar como no aplica la falta de ${dayRow.nombre_completo}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-3 py-1.5 text-xs font-semibold text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
      >
        <CircleSlash size={14} aria-hidden />
        {dayRow.status === "not_applicable" ? "Editar comentario" : "No aplica"}
      </button>
      {isOpen && <AbsenceNotApplicableModal dayRow={dayRow} idPeriod={idPeriod} onClose={closeModal} />}
    </>
  );
}
