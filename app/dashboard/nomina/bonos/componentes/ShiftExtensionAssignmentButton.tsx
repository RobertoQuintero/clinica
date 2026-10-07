"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserMinus } from "lucide-react";
import { setShiftExtensionAssignment } from "../actions";

interface Props {
  employeeId: number;
  employeeName: string;
  isAssigned: boolean;
}

/** Asigna o quita el bono. La confirmación es en línea: nunca usa el `confirm()` nativo. */
export default function ShiftExtensionAssignmentButton({ employeeId, employeeName, isAssigned }: Props) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const actionLabel = isAssigned ? "Quitar" : "Asignar";

  async function saveAssignment() {
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const result = await setShiftExtensionAssignment({ id_empleado: employeeId, activo: !isAssigned });
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
        aria-label={`${actionLabel} el bono por extensión de jornada a ${employeeName}`}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0051d5] dark:text-blue-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
      >
        {isAssigned ? <UserMinus size={14} aria-hidden /> : <UserCheck size={14} aria-hidden />}
        {actionLabel}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Confirmar: ${actionLabel.toLowerCase()} el bono a ${employeeName}`}
      className="flex flex-col items-end gap-1"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#44474f] dark:text-zinc-300">
          {isAssigned ? "¿Quitar el bono?" : "¿Asignar el bono?"}
        </span>
        <button
          type="button"
          onClick={saveAssignment}
          disabled={isSaving}
          className="rounded-lg bg-[#0051d5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#003ea7] transition-colors disabled:opacity-60"
        >
          {isSaving ? "Guardando…" : `Sí, ${actionLabel.toLowerCase()}`}
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
