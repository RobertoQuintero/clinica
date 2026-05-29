"use client";

import { IProducto } from "@/interfaces/producto";
import { IMetodoPago } from "@/interfaces/metodo_pago";
import { VentaForm } from "../actions";

interface Props {
  form:          VentaForm;
  productos:     IProducto[];
  metodosPagos:  IMetodoPago[];
  saving:        boolean;
  error:         string | null;
  onChange:      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSubmit:      (e: React.FormEvent) => void;
  onClose:       () => void;
}

const fmtCurrency = (val: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);

export default function VentaModal({
  form, productos, metodosPagos, saving, error, onChange, onSubmit, onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-zinc-900 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-6 py-4 sticky top-0 bg-white dark:bg-zinc-900 z-10">
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-50">
            {form.id_venta === 0 ? "Nueva venta" : "Editar venta"}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 flex flex-col gap-4">
          {error && (
            <p className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {/* Producto */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Producto</span>
            <select
              name="id_producto"
              value={form.id_producto}
              onChange={onChange}
              required
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value={0} disabled>Seleccionar producto…</option>
              {productos.map((p) => (
                <option key={p.id_producto} value={p.id_producto}>
                  {p.nombre} — {fmtCurrency(p.precio)}
                </option>
              ))}
            </select>
          </label>

          {/* Cantidad */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Cantidad</span>
            <input
              type="number"
              name="cantidad"
              value={form.cantidad}
              onChange={onChange}
              required
              min={1}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </label>

          {/* Método de pago */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Método de pago</span>
            <select
              name="idMetodoPago"
              value={form.idMetodoPago}
              onChange={onChange}
              required
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value={0} disabled>Seleccionar método…</option>
              {metodosPagos.map((m) => (
                <option key={m.idMetodoPago} value={m.idMetodoPago}>
                  {m.descripcion}
                </option>
              ))}
            </select>
          </label>

          {/* Total */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total</span>
            <input
              type="number"
              name="total"
              value={form.total}
              onChange={onChange}
              required
              min={0}
              step="0.01"
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || productos.length === 0 || metodosPagos.length === 0 || form.id_producto === 0 || form.idMetodoPago === 0}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 transition-colors disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
