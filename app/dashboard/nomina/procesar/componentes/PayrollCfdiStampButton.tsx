"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Stamp } from "lucide-react";
import { PAYROLL_RECEIPT_STALE_RETRY_MARKER } from "@/lib/payroll/constants";
import { stampPayrollReceipt } from "../actions";

interface Props {
  idPeriod: number;
  idEmpleado: number;
  /** "Reintentar" cambia el icono y el texto, pero llama a la misma action. */
  variant: "stamp" | "retry";
}

/** Botón mínimo de cliente, dentro de una celda que por lo demás es un Server Component. */
export default function PayrollCfdiStampButton({ idPeriod, idEmpleado, variant }: Props) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsStaleConfirmation, setNeedsStaleConfirmation] = useState(false);

  async function stamp(confirmStaleRetry: boolean) {
    setIsRunning(true);
    setErrorMessage(null);
    try {
      const result = await stampPayrollReceipt({ idPeriod, idEmpleado, confirmStaleRetry });
      if (!result.ok) {
        if (result.message === PAYROLL_RECEIPT_STALE_RETRY_MARKER) {
          setNeedsStaleConfirmation(true);
        } else {
          setErrorMessage(result.message);
        }
        return;
      }
      setNeedsStaleConfirmation(false);
      router.refresh();
    } catch {
      setErrorMessage("Error inesperado al timbrar");
    } finally {
      setIsRunning(false);
    }
  }

  if (needsStaleConfirmation) {
    return (
      <div className="flex flex-col items-end gap-1">
        <p className="max-w-[12rem] text-[11px] text-amber-700 dark:text-amber-400">
          Verifica en Facturapi que no se haya timbrado.
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setNeedsStaleConfirmation(false)}
            disabled={isRunning}
            className="rounded px-2 py-1 text-[11px] font-medium text-[#44474f] dark:text-zinc-400 hover:bg-[#eff4ff] dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => stamp(true)}
            disabled={isRunning}
            className="rounded bg-[#ba1a1a] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#ba1a1a]/90 disabled:opacity-60"
          >
            {isRunning ? "Timbrando…" : "Reintentar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => stamp(false)}
        disabled={isRunning}
        title={variant === "retry" ? "Reintentar timbrado" : "Timbrar CFDI"}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-[#0051d5] dark:text-blue-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {variant === "retry" ? <CheckCircle2 size={14} aria-hidden /> : <Stamp size={14} aria-hidden />}
        {isRunning ? "Timbrando…" : variant === "retry" ? "Reintentar" : "Timbrar"}
      </button>
      {errorMessage && (
        <p role="alert" className="max-w-[12rem] text-right text-[11px] text-[#ba1a1a] dark:text-red-400">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
