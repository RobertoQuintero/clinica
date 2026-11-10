"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Stamp } from "lucide-react";
import type { PayrollIssuerSummary } from "@/interfaces/payroll_cfdi";
import { getPayrollStampingQueue, stampPayrollReceipt } from "../actions";

interface Props {
  idPeriod: number;
  periodCode: string;
  payrollIssuer: PayrollIssuerSummary;
}

interface Progress {
  done: number;
  total: number;
  errors: number;
}

/**
 * "Timbrar pendientes" (spec 98): pide la cola de filas timbrables y llama `stampPayrollReceipt`
 * una por una, en secuencia (sin concurrencia), mostrando "n/total" y el conteo de errores.
 * "Detener" termina después del recibo en curso; lo que ya se timbró queda guardado.
 */
export default function PayrollStampPendingButton({ idPeriod, periodCode, payrollIssuer }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const stopRequested = useRef(false);

  const canStamp = payrollIssuer.active && payrollIssuer.hasCertificate;

  async function runQueue() {
    setIsRunning(true);
    setErrorMessage(null);
    stopRequested.current = false;

    const queueResult = await getPayrollStampingQueue({ idPeriod });
    if (!queueResult.ok) {
      setErrorMessage(queueResult.message);
      setIsRunning(false);
      return;
    }

    const queue = queueResult.data;
    let errors = 0;
    setProgress({ done: 0, total: queue.length, errors: 0 });

    for (let index = 0; index < queue.length; index++) {
      if (stopRequested.current) break;
      const result = await stampPayrollReceipt({ idPeriod, idEmpleado: queue[index] });
      if (!result.ok) errors += 1;
      setProgress({ done: index + 1, total: queue.length, errors });
    }

    setIsRunning(false);
    router.refresh();
  }

  function close() {
    if (isRunning) return;
    setIsOpen(false);
    setProgress(null);
    setErrorMessage(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={!canStamp}
        title={canStamp ? undefined : "No hay un emisor de nómina con CSD vigente"}
        className="inline-flex items-center gap-2 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 shadow-sm hover:bg-[#eff4ff] dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
      >
        <Stamp size={16} />
        Timbrar pendientes
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="payroll-stamp-pending-title"
            className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-6 text-left shadow-xl"
          >
            <h3 id="payroll-stamp-pending-title" className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">
              ¿Timbrar los CFDI pendientes de {periodCode}?
            </h3>
            <p className="mt-2 text-sm text-[#44474f] dark:text-zinc-400">
              Se timbrará con <strong className="text-[#0b1c30] dark:text-zinc-100">{payrollIssuer.name ?? "el emisor activo"}</strong>,
              en modo <strong className="text-[#0b1c30] dark:text-zinc-100">{payrollIssuer.isLive ? "Live" : "Test"}</strong>.{" "}
              {payrollIssuer.isLive
                ? "Los recibos tendrán validez fiscal ante el SAT."
                : "Los recibos no tendrán validez fiscal."}
            </p>

            {progress && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm font-medium text-[#0b1c30] dark:text-zinc-100">
                  <span className="tabular-nums">{progress.done}/{progress.total}</span>
                  {progress.errors > 0 && (
                    <span className="text-[#ba1a1a] dark:text-red-400">
                      {progress.errors} {progress.errors === 1 ? "error" : "errores"}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-[#eff4ff] dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-[#0051d5] transition-[width]"
                    style={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            )}

            {errorMessage && (
              <p role="alert" className="mt-3 rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {errorMessage}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={isRunning ? () => { stopRequested.current = true; } : close}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
              >
                {isRunning ? "Detener" : "Cerrar"}
              </button>
              {!progress && (
                <button
                  type="button"
                  onClick={runQueue}
                  className="rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003ea7] transition-colors"
                >
                  Timbrar pendientes
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
