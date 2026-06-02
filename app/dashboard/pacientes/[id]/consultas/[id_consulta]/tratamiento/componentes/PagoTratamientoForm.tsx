"use client";

import { IMetodoPago } from "@/interfaces/metodo_pago";
import { PagoFormData } from "../actions";

interface Props {
  form:         PagoFormData;
  metodosPago:  IMetodoPago[];
  onChange:     (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  disabled?:    boolean;
}

export default function PagoTratamientoForm({ form, metodosPago, onChange, disabled }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 space-y-5">
      <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
        Pago del tratamiento
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Total ($)
          </label>
          <input
            type="number"
            name="total"
            value={form.total}
            onChange={onChange}
            disabled={disabled}
            step="0.01"
            min="0"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Método de pago
          </label>
          <select
            name="idMetodoPago"
            value={form.idMetodoPago}
            onChange={onChange}
            disabled={disabled}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value={0}>— Selecciona método de pago —</option>
            {metodosPago.map((m) => (
              <option key={m.idMetodoPago} value={m.idMetodoPago}>
                {m.descripcion}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">
          Referencia
        </label>
        <input
          type="text"
          name="referencia"
          value={form.referencia}
          onChange={onChange}
          disabled={disabled}
          placeholder="Núm. de transferencia, folio, etc."
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
