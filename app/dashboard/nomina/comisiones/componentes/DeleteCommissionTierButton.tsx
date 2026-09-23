"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteCommissionTier } from "../actions";

interface Props {
  idCommissionTier: number;
  tierLabel: string;
}

/** Botón de borrar con diálogo de confirmación propio (sin `confirm()` nativo). */
export default function DeleteCommissionTierButton({ idCommissionTier, tierLabel }: Props) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfirming) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsConfirming(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isConfirming]);

  async function handleConfirmDelete() {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      const result = await deleteCommissionTier(idCommissionTier);
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      setIsConfirming(false);
      router.refresh();
    } catch {
      setErrorMessage("Error inesperado al eliminar el tramo");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErrorMessage(null);
          setIsConfirming(true);
        }}
        title="Eliminar tramo"
        aria-label={`Eliminar tramo de ${tierLabel}`}
        className="p-1.5 rounded-lg text-[#ba1a1a] hover:bg-[#ba1a1a]/10 transition-colors"
      >
        <Trash2 size={16} />
      </button>

      {isConfirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsConfirming(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-commission-tier-title"
            className="w-full max-w-sm rounded-xl bg-white dark:bg-zinc-900 p-6 text-left shadow-xl"
          >
            <h3 id="delete-commission-tier-title" className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">
              ¿Eliminar el tramo de {tierLabel}?
            </h3>
            <p className="mt-2 text-sm text-[#44474f] dark:text-zinc-400">
              Los periodos ya calculados conservan su comisión. Al recalcular un periodo, las consultas de este tramo
              dejarán de comisionar.
            </p>
            {errorMessage && (
              <p role="alert" className="mt-3 rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {errorMessage}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="rounded-lg bg-[#ba1a1a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ba1a1a]/90 disabled:opacity-60 transition-colors"
              >
                {isDeleting ? "Eliminando…" : "Eliminar tramo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
