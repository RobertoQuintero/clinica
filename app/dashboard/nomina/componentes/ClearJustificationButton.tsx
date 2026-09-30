"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import type { IJustifiableDay, JustificationAction } from "./justificationTypes";

interface Props {
  day: IJustifiableDay;
  idPeriod: number;
  /** Server action que borra la justificación (`clearAbsenceJustification`, `clearLatenessJustification`). */
  action: JustificationAction;
  /** Para el aria-label: "Volver a injustificada la falta de {empleado}". */
  ariaLabel: string;
  /** Texto del botón: "Volver a injustificada" o "Volver a injustificado". */
  buttonLabel: string;
}

/** Vuelve el día a "Injustificado". La confirmación es en línea: nunca usa el `confirm()` nativo. */
export function ClearJustificationButton({ day, idPeriod, action, ariaLabel, buttonLabel }: Props) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function clearJustification() {
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const result = await action({
        id_period: idPeriod,
        id_empleado: day.id_empleado,
        fecha: day.fecha,
      });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      setIsConfirming(false);
      router.refresh();
    } catch {
      setErrorMessage("Error inesperado al guardar");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        aria-label={ariaLabel}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
      >
        <Undo2 size={14} aria-hidden />
        {buttonLabel}
      </button>
    );
  }

  return (
    <div role="group" aria-label={`Confirmar: ${buttonLabel.toLowerCase()}`} className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#44474f] dark:text-zinc-300">¿Se descontará de nuevo?</span>
        <button
          type="button"
          onClick={clearJustification}
          disabled={isSaving}
          className="rounded-lg bg-[#ba1a1a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#ba1a1a]/90 transition-colors disabled:opacity-60"
        >
          {isSaving ? "Guardando…" : "Sí, volver"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsConfirming(false);
            setErrorMessage(null);
          }}
          disabled={isSaving}
          className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-3 py-1.5 text-xs font-semibold text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
      {errorMessage && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
