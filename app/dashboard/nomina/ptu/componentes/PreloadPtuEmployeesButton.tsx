"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { preloadPtuDistribution } from "../actions";

interface Props {
  idPtuDistribution: number;
  fiscalYear: number;
}

type Feedback = { kind: "success" | "error"; text: string };

function describePreloadResult(added: number, updated: number, fiscalYear: number): string {
  if (added === 0 && updated === 0) return `Sin cambios: ya está cargada la nómina fiscal ordinaria de ${fiscalYear}.`;
  const parts: string[] = [];
  if (added > 0) parts.push(`${added} ${added === 1 ? "trabajador agregado" : "trabajadores agregados"}`);
  if (updated > 0) parts.push(`${updated} ${updated === 1 ? "fila actualizada" : "filas actualizadas"}`);
  return parts.join(" y ");
}

/** Trae a los trabajadores con nómina fiscal ordinaria del ejercicio. Respeta las filas editadas a mano. */
export default function PreloadPtuEmployeesButton({ idPtuDistribution, fiscalYear }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function handlePreload() {
    setIsLoading(true);
    setFeedback(null);
    try {
      const result = await preloadPtuDistribution({ id_ptu_distribution: idPtuDistribution });
      if (!result.ok) {
        setFeedback({ kind: "error", text: result.message });
        return;
      }
      setFeedback({ kind: "success", text: describePreloadResult(result.data.added, result.data.updated, fiscalYear) });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", text: "Error inesperado al precargar los trabajadores" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start sm:items-end gap-2">
      <button
        type="button"
        onClick={handlePreload}
        disabled={isLoading}
        className="flex items-center gap-2 rounded-lg bg-[#0051d5] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <RefreshCw size={18} className={isLoading ? "animate-spin motion-reduce:animate-none" : undefined} />
        {isLoading ? "Precargando…" : "Precargar trabajadores"}
      </button>
      {feedback && (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={`text-sm ${
            feedback.kind === "error" ? "text-[#ba1a1a] dark:text-red-400" : "text-[#44474f] dark:text-zinc-400"
          }`}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}
