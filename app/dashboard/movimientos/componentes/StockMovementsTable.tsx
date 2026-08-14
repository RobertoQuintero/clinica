"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { useSucursal } from "@/contexts/SucursalContext";
import { addZeroToday } from "@/utils/date_helpper";
import {
  getMovementsSummary,
  getMovementTypes,
  getStockMovements,
  IMovementType,
  IStockMovementListItem,
  IStockMovementsSummary,
} from "../actions";
import StockMovementRow from "./StockMovementRow";
import { useMovementsRefresh } from "./MovementsRefreshContext";

const PAGE_SIZE = 25;
const today = addZeroToday(new Date());

export default function StockMovementsTable() {
  const { selectedId } = useSucursal();
  const { refreshToken } = useMovementsRefresh();

  const [movements, setMovements] = useState<IStockMovementListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [movementTypes, setMovementTypes] = useState<IMovementType[]>([]);
  const [summary, setSummary] = useState<IStockMovementsSummary>({
    units_in_today: 0,
    units_out_today: 0,
  });

  const [search, setSearch] = useState("");
  const [movementFilter, setMovementFilter] = useState("");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMovementTypes().then((result) => {
      if (result.ok) setMovementTypes(result.data);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    getMovementsSummary(selectedId).then((result) => {
      if (result.ok) setSummary(result.data);
    });
  }, [selectedId, refreshToken]);

  useEffect(() => {
    // Cualquier cambio de filtro reinicia la página, salvo el cambio de página en sí.
    setPage(1);
  }, [selectedId, search, movementFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    getStockMovements({
      id_sucursal: selectedId,
      search: search.trim() || null,
      id_movement: movementFilter ? Number(movementFilter) : null,
      date_from: dateFrom || null,
      date_to: dateTo || null,
      page,
      page_size: PAGE_SIZE,
    })
      .then((result) => {
        if (result.ok) {
          setMovements(result.data.items);
          setTotal(result.data.total);
        } else {
          setError(result.message);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedId, search, movementFilter, dateFrom, dateTo, page, refreshToken]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#eff4ff] dark:bg-zinc-800 p-5 rounded-lg border border-[#c4c6d0] dark:border-zinc-700 flex flex-col gap-2">
          <div className="flex justify-between items-center text-[#44474f] dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Entradas hoy</span>
            <ArrowDown size={18} className="text-[#009c6b] dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">
            {summary.units_in_today}
          </div>
        </div>
        <div className="bg-[#eff4ff] dark:bg-zinc-800 p-5 rounded-lg border border-[#c4c6d0] dark:border-zinc-700 flex flex-col gap-2">
          <div className="flex justify-between items-center text-[#44474f] dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Salidas hoy</span>
            <ArrowUp size={18} className="text-[#0051d5] dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">
            {summary.units_out_today}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-[#c4c6d0] dark:border-zinc-700 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-1/3">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474f] dark:text-zinc-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por producto o código…"
            className="w-full pl-10 pr-4 py-2 bg-[#eff4ff] dark:bg-zinc-800 border border-[#c4c6d0] dark:border-zinc-600 rounded-lg text-sm text-[#0b1c30] dark:text-zinc-100 placeholder:text-[#747780] dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5]"
          />
        </div>
        <div className="flex flex-wrap gap-4 w-full md:w-auto items-center">
          <select
            value={movementFilter}
            onChange={(e) => setMovementFilter(e.target.value)}
            className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 px-4 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] min-w-[160px]"
          >
            <option value="">Todos los tipos</option>
            {movementTypes.map((movement) => (
              <option key={movement.id_movement} value={movement.id_movement}>
                {movement.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#44474f] dark:text-zinc-400">Del</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5]"
            />
            <label className="text-xs text-[#44474f] dark:text-zinc-400">Al</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5]"
            />
          </div>
        </div>
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
                  <th className="px-6 py-4 font-semibold">ID movimiento</th>
                  <th className="px-6 py-4 font-semibold">Fecha y hora</th>
                  <th className="px-6 py-4 font-semibold">Tipo</th>
                  <th className="px-6 py-4 font-semibold">Producto</th>
                  <th className="px-6 py-4 font-semibold text-right">Cantidad</th>
                  <th className="px-6 py-4 font-semibold">Origen/Destino</th>
                  <th className="px-6 py-4 font-semibold">Responsable</th>
                  <th className="px-6 py-4 font-semibold">Comentarios</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-6 text-center text-[#747780] dark:text-zinc-500">
                      No hay movimientos que coincidan con los filtros
                    </td>
                  </tr>
                ) : (
                  movements.map((movement) => (
                    <StockMovementRow key={movement.id_kardex} movement={movement} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
            <span>
              Página {page} de {totalPages} · {total} movimiento{total === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-3 py-1.5 disabled:opacity-40 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-3 py-1.5 disabled:opacity-40 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
