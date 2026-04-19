import { IPago } from "@/interfaces/pago";
import React from "react";
import { fmtDate } from "./helpers";

interface Props {
  costoTotal:         number;
  onCostoTotalChange: (val: number) => void;
  totalPagado:        number;
  saldo:              number;
  pagos:              IPago[];
  pagoForm:           Omit<IPago, "id_pago" | "created_at" | "id_empresa">;
  onPagoFormChange:   React.Dispatch<React.SetStateAction<Omit<IPago, "id_pago" | "created_at" | "id_empresa">>>;
  saving:             boolean;
  error:              string | null;
  onSubmit:           (e: React.FormEvent) => void;
  locked?:            boolean;
  onFinalizar?:       () => void;
  procesoPagado?:     boolean;
}

export default function TabPagar({
  costoTotal,
  onCostoTotalChange,
  totalPagado,
  saldo,
  pagos,
  pagoForm,
  onPagoFormChange,
  saving,
  error,
  onSubmit,
  locked,
  onFinalizar,
  procesoPagado,
}: Props) {
  React.useEffect(() => {
    if (saldo > 0) {
      onPagoFormChange((f) => ({ ...f, monto: saldo }));
    }
  }, [saldo]);

  return (
    <div className="space-y-6">

      {/* resumen */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 text-center text-sm">
        <div>
          <p className="text-zinc-500">Pagado</p>
          <p className="mt-1 text-lg font-semibold text-green-600 dark:text-green-400">${totalPagado.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-zinc-500">Saldo</p>
          <p className={`mt-1 text-lg font-semibold ${saldo > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
            ${saldo.toFixed(2)}
          </p>
        </div>
      </div>

      {/* pagos registrados */}
      {pagos.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                {["#", "Fecha", "Método", "Monto", "Referencia"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
              {pagos.map((pg) => (
                <tr key={pg.id_pago} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 text-zinc-500">{pg.id_pago}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">{fmtDate(pg.fecha_pago)}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 capitalize">{pg.metodo_pago}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 font-medium">${Number(pg.monto).toFixed(2)}</td>
                  <td className="px-4 py-3 text-zinc-500">{pg.referencia || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* nuevo pago */}
      {saldo > 0 && !locked && (
        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Registrar pago</h3>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Monto</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={saldo}
                value={pagoForm.monto !== 0 ? pagoForm.monto : saldo}
                onChange={(e) => onPagoFormChange((f) => ({ ...f, monto: Number(e.target.value) }))}
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Método de pago</label>
              <select
                value={pagoForm.metodo_pago}
                onChange={(e) => onPagoFormChange((f) => ({ ...f, metodo_pago: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Fecha de pago</label>
              <input
                type="date"
                value={String(pagoForm.fecha_pago ?? "").slice(0, 10)}
                onChange={(e) => onPagoFormChange((f) => ({ ...f, fecha_pago: e.target.value }))}
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Referencia</label>
              <input
                type="text"
                value={pagoForm.referencia}
                onChange={(e) => onPagoFormChange((f) => ({ ...f, referencia: e.target.value }))}
                placeholder="Opcional"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors dark:bg-zinc-600 dark:hover:bg-zinc-500"
            >
              {saving ? "Guardando..." : "Registrar pago"}
            </button>
          </div>
        </form>
      )}

      {saldo <= 0 && pagos.length > 0 && (
        <p className="text-center text-sm font-medium text-green-600 dark:text-green-400">
          Consulta pagada en su totalidad ✓
        </p>
      )}

      {/* finalizar proceso */}
      {!procesoPagado && !locked && saldo <= 0 && pagos.length > 0 && onFinalizar && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onFinalizar}
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 transition-colors"
          >
            Finalizar proceso
          </button>
        </div>
      )}

      {procesoPagado && (
        <p className="text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Proceso finalizado
        </p>
      )}
    </div>
  );
}
