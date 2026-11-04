"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deletePendingDayPayment } from "../actions";

interface Props {
  idPendingDayPayment: number;
  idPeriod: number;
  employeeName: string;
  fecha: string;
}

/** Borra una captura (DELETE físico). La confirmación es en línea: nunca usa el `confirm()` nativo. */
export default function DeletePendingDayPaymentButton({ idPendingDayPayment, idPeriod, employeeName, fecha }: Props) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function confirmDelete() {
    setErrorMessage(null);
    setIsDeleting(true);
    try {
      const result = await deletePendingDayPayment({ id_pending_day_payment: idPendingDayPayment, id_period: idPeriod });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
    } catch {
      setErrorMessage("Error inesperado al borrar");
    } finally {
      setIsDeleting(false);
      setIsConfirming(false);
    }
  }

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        aria-label={`Borrar la captura del ${fecha} de ${employeeName}`}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#ba1a1a] dark:text-red-400 hover:bg-[#ba1a1a]/10 dark:hover:bg-red-900/20 transition-colors whitespace-nowrap"
      >
        <Trash2 size={14} aria-hidden />
        Borrar
      </button>
    );
  }

  return (
    <div role="group" aria-label={`Confirmar borrar la captura de ${employeeName}`} className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#44474f] dark:text-zinc-300">¿Borrar esta captura?</span>
        <button
          type="button"
          onClick={confirmDelete}
          disabled={isDeleting}
          className="rounded-lg bg-[#ba1a1a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#9c1414] transition-colors disabled:opacity-60"
        >
          {isDeleting ? "Borrando…" : "Sí, borrar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsConfirming(false);
            setErrorMessage(null);
          }}
          disabled={isDeleting}
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
