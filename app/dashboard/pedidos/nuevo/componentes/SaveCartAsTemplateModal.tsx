"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createPurchaseOrderTemplate } from "@/app/dashboard/pedidos/actions";
import { usePurchaseCart } from "@/contexts/PurchaseCartContext";
import { useSucursal } from "@/contexts/SucursalContext";

interface Props {
  onClose:  () => void;
  onSaved:  () => void;
}

export default function SaveCartAsTemplateModal({ onClose, onSaved }: Props) {
  const { lines } = usePurchaseCart();
  const { selectedId } = useSucursal();

  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  if (!mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("El nombre de la plantilla es obligatorio");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await createPurchaseOrderTemplate({
      name: trimmedName,
      id_sucursal: selectedId,
      lines: lines.map((line) => ({
        id_product: line.id_product,
        id_supplier: line.id_supplier,
        quantity: line.quantity,
      })),
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onSaved();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <h2 className="text-base font-semibold text-[#0b1c30] dark:text-zinc-100">
            Guardar como plantilla
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-[#44474f] hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            Se guardarán {lines.length} {lines.length === 1 ? "producto" : "productos"} del carrito actual.
          </p>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#44474f] dark:text-zinc-400">
              Nombre de la plantilla
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              maxLength={150}
              required
              placeholder="Ej. Básicos de Sucursal Norte"
              className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5]"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-[#ba1a1a] dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-4 py-2 text-sm font-medium text-[#44474f] dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Guardando…" : "Guardar plantilla"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
