"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSucursal } from "@/contexts/SucursalContext";
import { getPendingReceptions, IPendingReception } from "./actions";
import OrderStatusBadge from "@/app/dashboard/componentes/OrderStatusBadge";
import { dayFirst } from "@/utils/date_helpper";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export default function RecepcionesPage() {
  const router = useRouter();
  const { selectedId } = useSucursal();

  const [receptions, setReceptions] = useState<IPendingReception[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    getPendingReceptions(selectedId)
      .then((result) => {
        if (result.ok) {
          setReceptions(result.data);
        } else {
          setError(result.message);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">
          Recepciones pendientes
        </h2>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Órdenes de compra enviadas que están esperando la entrada de mercancía.
        </p>
      </div>

      {error && <p className="text-sm text-[#ba1a1a] dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-[#44474f] dark:text-zinc-400">Cargando…</p>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
                <tr>
                  <th className="px-6 py-4 font-semibold">Folio</th>
                  <th className="px-6 py-4 font-semibold">Proveedor</th>
                  <th className="px-6 py-4 font-semibold">Estado</th>
                  <th className="px-6 py-4 font-semibold">Entrega estimada</th>
                  <th className="px-6 py-4 font-semibold">Avance</th>
                  <th className="px-6 py-4 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {receptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-6 text-center text-[#747780] dark:text-zinc-500">
                      No hay recepciones pendientes
                    </td>
                  </tr>
                ) : (
                  receptions.map((reception) => (
                    <tr
                      key={reception.id_purchase_order}
                      onClick={() => router.push(`/dashboard/recepciones/${reception.id_purchase_order}`)}
                      className="border-b border-[#c4c6d0] dark:border-zinc-700 hover:bg-[#eff4ff]/50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 font-semibold text-[#0b1c30] dark:text-zinc-100">
                        {reception.folio}
                      </td>
                      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">
                        {reception.supplier_name}
                      </td>
                      <td className="px-6 py-4">
                        <OrderStatusBadge id_status={reception.id_status} />
                      </td>
                      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">
                        {reception.estimated_date ? dayFirst(reception.estimated_date + "T00:00:00") : "—"}
                      </td>
                      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">
                        {reception.lines_completed}/{reception.lines_total} líneas
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-[#0b1c30] dark:text-zinc-100">
                        {currencyFormatter.format(reception.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
