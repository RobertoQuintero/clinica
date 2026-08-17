"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, TriangleAlert } from "lucide-react";
import {
  getPurchaseOrderTemplateById,
  updatePurchaseOrderTemplate,
} from "@/app/dashboard/pedidos/actions";
import { getSuppliers } from "@/app/dashboard/proveedores/actions";
import { IPurchaseOrderTemplateItemDetail } from "@/interfaces/purchase_order_template";
import { ISupplier } from "@/interfaces/supplier";

interface Props {
  id_purchase_order_template: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditOrderTemplateModal({ id_purchase_order_template, onClose, onSaved }: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [items, setItems] = useState<IPurchaseOrderTemplateItemDetail[]>([]);
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getPurchaseOrderTemplateById(id_purchase_order_template),
      getSuppliers(),
    ]).then(([templateResult, supplierList]) => {
      setSuppliers(supplierList);
      if (!templateResult.ok) {
        setError(templateResult.message);
        setLoading(false);
        return;
      }
      setName(templateResult.data.template.name);
      setItems(templateResult.data.items);
      setLoading(false);
    });
  }, [id_purchase_order_template]);

  if (!mounted) return null;

  const setItemQuantity = (id_product: number, quantity: number) => {
    setItems((current) =>
      current.map((item) => (item.id_product === id_product ? { ...item, quantity } : item))
    );
  };

  const setItemSupplier = (id_product: number, id_supplier: number | null) => {
    setItems((current) =>
      current.map((item) => (item.id_product === id_product ? { ...item, id_supplier } : item))
    );
  };

  const removeItem = (id_product: number) => {
    setItems((current) => current.filter((item) => item.id_product !== id_product));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("El nombre de la plantilla es obligatorio");
      return;
    }
    if (items.length === 0) {
      setError("La plantilla debe tener al menos una línea");
      return;
    }

    setSaving(true);
    setError(null);

    const result = await updatePurchaseOrderTemplate({
      id_purchase_order_template,
      name: trimmedName,
      lines: items.map((item) => ({
        id_product: item.id_product,
        id_supplier: item.id_supplier,
        quantity: item.quantity,
      })),
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onSaved();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-xl bg-white dark:bg-zinc-900 shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4 shrink-0">
          <h2 className="text-base font-semibold text-[#0b1c30] dark:text-zinc-100">
            Editar plantilla
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-[#44474f] hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <p className="px-6 py-8 text-sm text-[#44474f] dark:text-zinc-400">Cargando…</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
            <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#44474f] dark:text-zinc-400">
                  Nombre de la plantilla
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  maxLength={150}
                  required
                  className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-[#44474f] dark:text-zinc-400">
                  Productos ({items.length})
                </span>

                {items.length === 0 ? (
                  <p className="text-sm text-[#44474f] dark:text-zinc-400 py-4 text-center">
                    No quedan productos en la plantilla.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {items.map((item) => (
                      <div
                        key={item.id_product}
                        className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
                          item.is_available
                            ? "border-[#c4c6d0] dark:border-zinc-700"
                            : "border-[#ffd8cc] bg-[#fff8f6] dark:border-orange-900/50 dark:bg-orange-900/10"
                        }`}
                      >
                        <div className="flex-1 min-w-[160px]">
                          <p className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">
                            {item.product_name || `Producto #${item.id_product}`}
                          </p>
                          {!item.is_available && (
                            <p className="flex items-center gap-1 text-xs text-[#d94f27] dark:text-orange-400">
                              <TriangleAlert size={12} /> Ya no disponible
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-[#44474f] dark:text-zinc-400">
                            Cantidad
                          </label>
                          <input
                            type="number"
                            min={1}
                            step="1"
                            value={item.quantity}
                            onChange={(e) =>
                              setItemQuantity(item.id_product, Math.max(1, Number(e.target.value) || 1))
                            }
                            className="w-20 text-center py-1 border border-[#c4c6d0] dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-[#0b1c30] dark:text-zinc-100 outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5]"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-[#44474f] dark:text-zinc-400">
                            Proveedor
                          </label>
                          <select
                            value={item.id_supplier ?? ""}
                            onChange={(e) =>
                              setItemSupplier(item.id_product, e.target.value ? Number(e.target.value) : null)
                            }
                            className="rounded border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-sm text-[#0b1c30] dark:text-zinc-100 outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] min-w-[140px]"
                          >
                            <option value="">Sin proveedor</option>
                            {suppliers.map((supplier) => (
                              <option key={supplier.id_proveedor} value={supplier.id_proveedor}>
                                {supplier.nombre_corto}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.id_product)}
                          title="Quitar línea"
                          className="p-2 text-[#44474f] dark:text-zinc-400 hover:text-[#ba1a1a] dark:hover:text-red-400 transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <p className="rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-[#ba1a1a] dark:text-red-400">
                  {error}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-[#c4c6d0] dark:border-zinc-700 px-6 py-4 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-4 py-2 text-sm font-medium text-[#44474f] dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
