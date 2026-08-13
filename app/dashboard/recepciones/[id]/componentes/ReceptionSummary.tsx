"use client";

import { CheckCircle2 } from "lucide-react";

interface Props {
  linesTotal:            number;
  linesCompleted:        number;
  linesWithDifference:   number;
  notes:                 string;
  onNotesChange:         (notes: string) => void;
  onConfirm:             () => void;
  submitting:            boolean;
  disabled:              boolean;
  error:                 string | null;
}

export default function ReceptionSummary({
  linesTotal,
  linesCompleted,
  linesWithDifference,
  notes,
  onNotesChange,
  onConfirm,
  submitting,
  disabled,
  error,
}: Props) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-6 flex flex-col gap-6">
      <h3 className="text-lg font-bold text-[#0b1c30] dark:text-zinc-50 border-b border-[#c4c6d0] dark:border-zinc-700 pb-4">
        Resumen de recepción
      </h3>

      <div className="flex flex-col gap-3 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-[#44474f] dark:text-zinc-400">Líneas en orden</span>
          <span className="font-medium text-[#0b1c30] dark:text-zinc-100">{linesTotal}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#44474f] dark:text-zinc-400">Líneas completas</span>
          <span className="font-medium text-[#009c6b] dark:text-emerald-400">{linesCompleted}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#44474f] dark:text-zinc-400">Líneas con diferencia</span>
          <span className="font-medium text-[#ba1a1a] dark:text-red-400">{linesWithDifference}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-4 border-t border-[#c4c6d0] dark:border-zinc-700">
        <label className="text-xs font-semibold text-[#44474f] dark:text-zinc-400">
          Notas de recepción (opcional)
        </label>
        <textarea
          rows={3}
          placeholder="Añade comentarios sobre el estado de la entrega..."
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="w-full resize-none rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 p-3 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5]"
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        onClick={onConfirm}
        disabled={disabled || submitting}
        className="w-full bg-[#0051d5] text-white py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <CheckCircle2 size={18} />
        {submitting ? "Confirmando…" : "Confirmar Recepción"}
      </button>
    </div>
  );
}
