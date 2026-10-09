"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { copyWithholdingTableFromPreviousYear } from "../actions";

interface Props {
  year: number;
}

/** Copia la tarifa semanal de `year - 1` a `year`; el servidor rechaza si el ejercicio ya tiene tramos. */
export default function CopyWithholdingTableButton({ year }: Props) {
  const router = useRouter();
  const [isCopying, setIsCopying] = useState(false);
  const [feedback, setFeedback] = useState<{ isError: boolean; message: string } | null>(null);

  async function handleCopy() {
    setIsCopying(true);
    setFeedback(null);
    try {
      const result = await copyWithholdingTableFromPreviousYear({ ejercicio_destino: year });
      if (!result.ok) {
        setFeedback({ isError: true, message: result.message });
        return;
      }
      setFeedback({ isError: false, message: `Se copiaron ${result.data} tramos de ${year - 1}` });
      router.refresh();
    } catch {
      setFeedback({ isError: true, message: "Error inesperado al copiar la tarifa" });
    } finally {
      setIsCopying(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleCopy}
        disabled={isCopying}
        className="flex items-center gap-2 rounded-lg border border-[#c4c6d0] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 disabled:opacity-60 transition-colors"
      >
        <Copy size={16} />
        {isCopying ? "Copiando…" : `Copiar de ${year - 1}`}
      </button>
      {feedback && (
        <p
          role={feedback.isError ? "alert" : "status"}
          className={`text-xs max-w-xs text-right ${
            feedback.isError ? "text-[#ba1a1a] dark:text-red-400" : "text-[#44474f] dark:text-zinc-400"
          }`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
