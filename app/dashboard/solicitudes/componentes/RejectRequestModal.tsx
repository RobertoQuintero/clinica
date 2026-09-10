"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { rejectPurchaseRequest } from "../actions";

interface Props {
  id_purchase_request: number;
  onClose:    () => void;
  onRejected: () => void;
}

/** Motivo obligatorio: no se puede enviar sin texto (criterio de aceptación de la spec 48). */
export default function RejectRequestModal({ id_purchase_request, onClose, onRejected }: Props) {
  const [mounted, setMounted]     = useState(false);
  const [reason, setReason]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("El motivo de rechazo es obligatorio");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await rejectPurchaseRequest({
      id_purchase_request,
      rejection_reason: reason.trim(),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onRejected();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <h3 className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100">Rechazar solicitud</h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-[#44474f] dark:text-zinc-400 hover:text-[#0b1c30] dark:hover:text-zinc-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#44474f] dark:text-zinc-400 mb-1">
              Motivo del rechazo *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Explica por qué se rechaza la solicitud"
              className="w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] resize-none"
            />
          </div>
          {error && (
            <p className="rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-4 py-2 text-sm font-medium text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
            className="rounded-lg bg-[#ba1a1a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ba1a1a]/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "Rechazando…" : "Rechazar solicitud"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
