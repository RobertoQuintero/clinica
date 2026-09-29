"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Paperclip } from "lucide-react";
import type { IAbsenceDayRow } from "@/interfaces/payroll_absence";
import { DOCUMENT_FILE_ACCEPT, uploadDocumentFile, validateDocumentFile } from "@/utils/documentUpload";
import { justifyAbsence } from "../actions";
import AbsenceModalFrame, { ABSENCE_FIELD_CLASSES, ABSENCE_MAX_COMMENT_LENGTH } from "./AbsenceModalFrame";

const UPLOAD_FOLDER = "clinica/empleados/faltas";

interface ModalProps {
  dayRow: IAbsenceDayRow;
  idPeriod: number;
  onClose: () => void;
}

function AbsenceJustificationModal({ dayRow, idPeriod, onClose }: ModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [commentText, setCommentText] = useState(dayRow.status === "justified" ? (dayRow.comentario ?? "") : "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isReplacing = dayRow.status === "justified";

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    const fileError = validateDocumentFile(file);
    if (fileError) {
      setSelectedFile(null);
      setErrorMessage(fileError);
      return;
    }
    setErrorMessage(null);
    setSelectedFile(file);
  }

  async function saveJustification() {
    if (!selectedFile) {
      setErrorMessage("Selecciona el archivo del justificante.");
      return;
    }
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const fileName = `falta_${dayRow.id_empleado}_${dayRow.fecha}_${Date.now()}_${selectedFile.name}`;
      const fileUrl = await uploadDocumentFile(selectedFile, UPLOAD_FOLDER, fileName);
      const result = await justifyAbsence({
        id_period: idPeriod,
        id_empleado: dayRow.id_empleado,
        fecha: dayRow.fecha,
        url: fileUrl,
        mime_type: selectedFile.type,
        size_bytes: selectedFile.size,
        comentario: commentText.trim() || undefined,
      });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Error inesperado al guardar el justificante");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AbsenceModalFrame
      titleId="absence-justification-modal-title"
      title={isReplacing ? "Reemplazar justificante" : "Subir justificante"}
      icon={<FileUp size={18} />}
      dayRow={dayRow}
      isBusy={isSaving}
      onClose={onClose}
    >
      {errorMessage && (
        <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">Archivo</span>
        <input
          ref={fileInputRef}
          type="file"
          accept={DOCUMENT_FILE_ACCEPT}
          onChange={handleFileChange}
          disabled={isSaving}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSaving}
          className="flex items-center gap-3 rounded-lg border-2 border-dashed border-[#c4c6d0] dark:border-zinc-600 bg-[#f8f9fb] dark:bg-zinc-800/50 px-4 py-4 text-left hover:bg-[#f3f3f4] dark:hover:bg-zinc-800 transition-colors disabled:opacity-60"
        >
          <Paperclip size={18} className="shrink-0 text-[#0051d5] dark:text-blue-400" aria-hidden />
          <span className="text-sm text-[#0b1c30] dark:text-zinc-100 truncate">
            {selectedFile ? selectedFile.name : "Elegir un archivo"}
          </span>
        </button>
        <span className="text-xs text-[#747780] dark:text-zinc-500">PDF, JPG o PNG, máximo 5 MB.</span>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
        <span>
          Comentario <span className="font-normal text-[#747780] dark:text-zinc-500">(opcional)</span>
        </span>
        <textarea
          rows={3}
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
          onClick={saveJustification}
          disabled={isSaving}
          className="rounded-lg bg-[#0051d5] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? "Guardando…" : isReplacing ? "Reemplazar" : "Guardar justificante"}
        </button>
      </div>
    </AbsenceModalFrame>
  );
}

interface ButtonProps {
  dayRow: IAbsenceDayRow;
  idPeriod: number;
}

/** Botón por fila: abre el modal para subir el justificante, o para reemplazarlo si el día ya está justificado. */
export function JustifyAbsenceButton({ dayRow, idPeriod }: ButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);
  const isReplacing = dayRow.status === "justified";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`${isReplacing ? "Reemplazar" : "Subir"} justificante de ${dayRow.nombre_completo}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-3 py-1.5 text-xs font-semibold text-[#0051d5] dark:text-blue-300 hover:bg-[#dce9ff] dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
      >
        <FileUp size={14} aria-hidden />
        {isReplacing ? "Reemplazar" : "Subir justificante"}
      </button>
      {isOpen && <AbsenceJustificationModal dayRow={dayRow} idPeriod={idPeriod} onClose={closeModal} />}
    </>
  );
}
