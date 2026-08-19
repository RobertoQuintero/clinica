"use client";

import { useEffect, useState } from "react";
import { useSucursal } from "@/contexts/SucursalContext";
import { useAuth } from "@/contexts/AuthContext";
import { getStockCounts, IStockCountListItem } from "../actions";
import StockCountRow from "./StockCountRow";

const SUPERVISOR_ROLE_IDS = [1, 4];

export default function StockCountsTable() {
  const { selectedId } = useSucursal();
  const { user } = useAuth();
  const isSupervisor = user ? SUPERVISOR_ROLE_IDS.includes(user.id_role) : false;

  const [counts, setCounts] = useState<IStockCountListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    getStockCounts(selectedId)
      .then((result) => {
        if (result.ok) {
          setCounts(result.data);
        } else {
          setError(result.message);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

  if (loading) {
    return <p className="text-[#44474f] dark:text-zinc-400">Cargando…</p>;
  }

  if (error) {
    return <p className="text-sm text-[#ba1a1a] dark:text-red-400">{error}</p>;
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
            <tr>
              <th className="px-6 py-4 font-semibold">Folio</th>
              <th className="px-6 py-4 font-semibold">Tipo</th>
              <th className="px-6 py-4 font-semibold">Capturado por</th>
              <th className="px-6 py-4 font-semibold">Fecha</th>
              <th className="px-6 py-4 font-semibold">Estado</th>
              <th className="px-6 py-4 font-semibold text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {counts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-center text-[#747780] dark:text-zinc-500">
                  Aún no hay conteos registrados en esta sucursal
                </td>
              </tr>
            ) : (
              counts.map((item) => (
                <StockCountRow key={item.id_stock_count} item={item} isSupervisor={isSupervisor} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
