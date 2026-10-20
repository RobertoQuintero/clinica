"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, LockKeyholeOpen } from "lucide-react";
import type { PtuDistributionStatus } from "@/interfaces/payroll_ptu";
import { closePtuDistribution, reopenPtuDistribution } from "../actions";
import DeletePtuDistributionButton from "./DeletePtuDistributionButton";

interface Props {
  idPtuDistribution: number;
  fiscalYear: number;
  status: PtuDistributionStatus;
  /** Motivo por el que "Reabrir" no está disponible (un periodo PTU calculado usa el reparto); null si se puede. */
  reopenBlockedReason?: string | null;
}

const DIALOG_COPY = {
  close: {
    title: (fiscalYear: number) => `¿Cerrar el reparto de PTU ${fiscalYear}?`,
    body: "Queda de solo lectura y se congela la sucursal de cada trabajador. Antes de cerrar, el reparto se recalcula con los datos actuales de los empleados.",
    confirm: "Cerrar reparto",
    confirming: "Cerrando…",
  },
  reopen: {
    title: (fiscalYear: number) => `¿Reabrir el reparto de PTU ${fiscalYear}?`,
    body: "Vuelve a borrador y se puede editar. Si otro reparto de un año posterior usa este como historial, se actualiza hasta su siguiente cambio.",
    confirm: "Reabrir reparto",
    confirming: "Reabriendo…",
  },
} as const;

/** Cerrar, reabrir y eliminar el reparto, cada uno con diálogo de confirmación propio (sin `confirm()` nativo). */
export default function PtuDistributionStatusActions({
  idPtuDistribution,
  fiscalYear,
  status,
  reopenBlockedReason = null,
}: Props) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"close" | "reopen" | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingAction) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPendingAction(null);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [pendingAction]);

  async function handleConfirm() {
    if (!pendingAction) return;
    setIsWorking(true);
    setErrorMessage(null);
    try {
      const run = pendingAction === "close" ? closePtuDistribution : reopenPtuDistribution;
      const result = await run({ id_ptu_distribution: idPtuDistribution });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      setPendingAction(null);
      router.refresh();
    } catch {
      setErrorMessage("Error inesperado al cambiar el estado del reparto");
    } finally {
      setIsWorking(false);
    }
  }

  function openDialog(action: "close" | "reopen") {
    setErrorMessage(null);
    setPendingAction(action);
  }

  const copy = pendingAction ? DIALOG_COPY[pendingAction] : null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "B" ? (
        <>
          <button
            type="button"
            onClick={() => openDialog("close")}
            className="flex items-center gap-2 rounded-lg bg-[#009c6b] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#009c6b]/90"
          >
            <LockKeyhole size={16} />
            Cerrar reparto
          </button>
          <DeletePtuDistributionButton
            idPtuDistribution={idPtuDistribution}
            fiscalYear={fiscalYear}
            variant="labeled"
            redirectTo="/dashboard/nomina/ptu"
          />
        </>
      ) : (
        <div className="flex flex-col items-start gap-1.5">
          <button
            type="button"
            onClick={() => openDialog("reopen")}
            disabled={reopenBlockedReason !== null}
            aria-describedby={reopenBlockedReason ? "ptu-reopen-blocked-reason" : undefined}
            className="flex items-center gap-2 rounded-lg border border-[#0051d5] px-4 py-2 text-sm font-semibold text-[#0051d5] hover:bg-[#0051d5]/10 transition-colors disabled:cursor-not-allowed disabled:border-[#c4c6d0] disabled:text-[#747780] disabled:hover:bg-transparent dark:disabled:border-zinc-700 dark:disabled:text-zinc-500"
          >
            <LockKeyholeOpen size={16} />
            Reabrir reparto
          </button>
          {reopenBlockedReason && (
            <p id="ptu-reopen-blocked-reason" className="max-w-md text-xs text-[#44474f] dark:text-zinc-400">
              {reopenBlockedReason}
            </p>
          )}
        </div>
      )}

      {copy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPendingAction(null);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ptu-status-dialog-title"
            className="w-full max-w-sm rounded-xl bg-white dark:bg-zinc-900 p-6 text-left shadow-xl"
          >
            <h3 id="ptu-status-dialog-title" className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">
              {copy.title(fiscalYear)}
            </h3>
            <p className="mt-2 text-sm text-[#44474f] dark:text-zinc-400">{copy.body}</p>
            {errorMessage && (
              <p role="alert" className="mt-3 rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {errorMessage}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isWorking}
                className="rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0051d5]/90 disabled:opacity-60 transition-colors"
              >
                {isWorking ? copy.confirming : copy.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
