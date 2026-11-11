"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { refreshPayrollCancellationStatus } from "../actions";

interface Props {
  idReceipt: number;
}

/** Botón "Consultar estado" de un recibo `'X'`: vuelve a preguntarle a Facturapi (spec 99). */
export default function PayrollCfdiRefreshStatusButton({ idReceipt }: Props) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function refresh() {
    setIsRunning(true);
    setErrorMessage(null);
    try {
      const result = await refreshPayrollCancellationStatus({ idReceipt });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
    } catch {
      setErrorMessage("Error inesperado al consultar el estado");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={refresh}
        disabled={isRunning}
        title="Consultar estado de la cancelación"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-[#0051d5] dark:text-blue-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw size={14} aria-hidden />
        {isRunning ? "Consultando…" : "Consultar estado"}
      </button>
      {errorMessage && (
        <p role="alert" className="max-w-[12rem] text-right text-[11px] text-[#ba1a1a] dark:text-red-400">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
