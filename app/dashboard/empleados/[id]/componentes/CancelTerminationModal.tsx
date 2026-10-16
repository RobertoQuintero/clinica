"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UndoDot } from "lucide-react";
import JustificationModalFrame, {
  JUSTIFICATION_FIELD_CLASSES,
} from "@/app/dashboard/nomina/componentes/JustificationModalFrame";
import type { IEmployeeTermination } from "@/interfaces/employee_termination";
import {
  TERMINATION_NOTES_MAX_LENGTH,
  TERMINATION_TYPE_LABELS,
} from "@/lib/terminations/terminationRules";
import { cancelEmployeeTermination } from "../bajas/actions";

interface Props {
  id_empleado: number;
  employeeName: string;
  termination: IEmployeeTermination;
  onClose: () => void;
}

/** Modal "Anular baja" (spec 86): motivo obligatorio; el empleado vuelve a quedar activo. */
export default function CancelTerminationModal({ id_empleado, employeeName, termination, onClose }: Props) {
  const router = useRouter();
  const [reasonText, setReasonText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function cancelTermination() {
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const result = await cancelEmployeeTermination({ id_empleado, motivo: reasonText });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al anular la baja");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <JustificationModalFrame
      titleId="cancel-termination-modal-title"
      title="Anular baja"
      icon={<UndoDot size={18} />}
      employeeName={employeeName}
      summaryItems={[
        { label: "Fecha de baja", value: termination.fecha_baja.split("-").reverse().join("/") },
        { label: "Causa", value: termination.nombre_causa },
        { label: "Tipo", value: TERMINATION_TYPE_LABELS[termination.tipo_terminacion] },
      ]}
      isBusy={isSaving}
      onClose={onClose}
    >
      {errorMessage && (
        <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <p className="text-sm text-[#44474f] dark:text-zinc-400">
        La baja se conserva en el historial como anulada y el empleado vuelve a quedar activo.
      </p>

      <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
        Motivo de la anulación
        <textarea
          rows={3}
          autoFocus
          maxLength={TERMINATION_NOTES_MAX_LENGTH}
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
          onClick={cancelTermination}
          disabled={isSaving || reasonText.trim() === ""}
          className="rounded-lg bg-[#0051d5] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? "Anulando…" : "Anular baja"}
        </button>
      </div>
    </JustificationModalFrame>
  );
}
