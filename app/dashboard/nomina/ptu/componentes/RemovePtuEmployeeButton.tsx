"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { removePtuDistributionEmployee } from "../actions";

interface Props {
  idPtuDistribution: number;
  idEmployee: number;
  employeeName: string;
}

/** Quita a un trabajador agregado a mano, con diálogo de confirmación propio (sin `confirm()` nativo). */
export default function RemovePtuEmployeeButton({ idPtuDistribution, idEmployee, employeeName }: Props) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfirming) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsConfirming(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isConfirming]);

  async function handleConfirmRemove() {
    setIsRemoving(true);
    setErrorMessage(null);
    try {
      const result = await removePtuDistributionEmployee({
        id_ptu_distribution: idPtuDistribution,
        id_empleado: idEmployee,
      });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      setIsConfirming(false);
      router.refresh();
    } catch {
      setErrorMessage("Error inesperado al quitar al trabajador");
    } finally {
      setIsRemoving(false);
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
        title="Quitar del reparto"
        aria-label={`Quitar a ${employeeName} del reparto`}
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
            aria-labelledby="remove-ptu-employee-title"
            className="w-full max-w-sm rounded-xl bg-white dark:bg-zinc-900 p-6 text-left shadow-xl"
          >
            <h3 id="remove-ptu-employee-title" className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">
              ¿Quitar a {employeeName} del reparto?
            </h3>
            <p className="mt-2 text-sm text-[#44474f] dark:text-zinc-400">
              Se recalcula el reparto sin esta fila. Puedes volver a agregarlo después.
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
                onClick={handleConfirmRemove}
                disabled={isRemoving}
                className="rounded-lg bg-[#ba1a1a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ba1a1a]/90 disabled:opacity-60 transition-colors"
              >
                {isRemoving ? "Quitando…" : "Quitar trabajador"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
