"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useSucursal } from "@/contexts/SucursalContext";
import { getPurchaseOrders, IPurchaseOrderListItem } from "./actions";
import { getSuppliers } from "@/app/dashboard/proveedores/actions";
import { ISupplier } from "@/interfaces/supplier";
import PurchaseOrderRow from "./componentes/PurchaseOrderRow";

const STATUS_OPTIONS = [
  { id_status: 1, label: "Pedido" },
  { id_status: 2, label: "Enviado" },
  { id_status: 4, label: "Parcial" },
  { id_status: 3, label: "Stock" },
  { id_status: 5, label: "Cancelado" },
];

export default function PedidosPage() {
  const { selectedId } = useSucursal();

  const [orders, setOrders]     = useState<IPurchaseOrderListItem[]>([]);
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [statusFilter, setStatusFilter]     = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [dateFrom, setDateFrom]             = useState("");
  const [dateTo, setDateTo]                 = useState("");

  useEffect(() => {
    getSuppliers().then(setSuppliers);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    getPurchaseOrders({
      id_sucursal: selectedId,
      id_status: statusFilter ? Number(statusFilter) : null,
      id_supplier: supplierFilter ? Number(supplierFilter) : null,
      date_from: dateFrom || null,
      date_to: dateTo || null,
    })
      .then((result) => {
        if (result.ok) {
          setOrders(result.data);
        } else {
          setError(result.message);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedId, statusFilter, supplierFilter, dateFrom, dateTo]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">
            Historial de pedidos
          </h2>
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            Consulta y da seguimiento a las órdenes de compra generadas.
          </p>
        </div>
        <Link
          href="/dashboard/pedidos/nuevo"
          className="flex items-center gap-2 rounded-lg bg-[#0051d5] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90"
        >
          <Plus size={18} />
          Nuevo Pedido
        </Link>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-4 flex flex-wrap gap-4 items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 px-4 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] min-w-[160px]"
        >
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.id_status} value={s.id_status}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 px-4 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] min-w-[160px]"
        >
          <option value="">Todos los proveedores</option>
          {suppliers.map((s) => (
            <option key={s.id_proveedor} value={s.id_proveedor}>
              {s.nombre_corto}
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
                  <th className="px-6 py-4 font-semibold">Fecha de pedido</th>
                  <th className="px-6 py-4 font-semibold">Entrega estimada</th>
                  <th className="px-6 py-4 font-semibold">Método de pago</th>
                  <th className="px-6 py-4 font-semibold text-right">Total</th>
                  <th className="px-6 py-4 w-10" />
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-6 text-center text-[#747780] dark:text-zinc-500">
                      Sin pedidos que coincidan con los filtros
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <PurchaseOrderRow key={order.id_purchase_order} order={order} />
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
