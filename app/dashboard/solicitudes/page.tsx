"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useSucursal } from "@/contexts/SucursalContext";
import { IPurchaseRequestListItem } from "@/interfaces/purchase_request";
import { getPendingPurchaseRequests } from "./actions";
import PurchaseRequestRow from "./componentes/PurchaseRequestRow";

/**
 * Solo solicitudes pendientes de la sucursal seleccionada (decisión explícita:
 * es un pendiente operativo, no un expediente personal, ver spec 48). Mismo
 * listado para rol 2 y para roles 1/4/6; lo que cambia son las acciones
 * disponibles en el detalle.
 */
export default function SolicitudesPage() {
  const { selectedId } = useSucursal();

  const [requests, setRequests] = useState<IPurchaseRequestListItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    getPendingPurchaseRequests(selectedId)
      .then((result) => {
        if (result.ok) {
          setRequests(result.data);
        } else {
          setError(result.message);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">
            Solicitudes de productos
          </h2>
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            Solicitudes pendientes de la sucursal seleccionada.
          </p>
        </div>
        <Link
          href="/dashboard/solicitudes/nueva"
          className="flex items-center gap-2 rounded-lg bg-[#0051d5] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90"
        >
          <Plus size={18} />
          Nueva solicitud
        </Link>
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
                  <th className="px-6 py-4 font-semibold">Creada por</th>
                  <th className="px-6 py-4 font-semibold">Fecha</th>
                  <th className="px-6 py-4 font-semibold">Productos</th>
                  <th className="px-6 py-4 font-semibold">Estado</th>
                  <th className="px-6 py-4 w-10" />
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-6 text-center text-[#747780] dark:text-zinc-500">
                      No hay solicitudes pendientes en esta sucursal
                    </td>
                  </tr>
                ) : (
                  requests.map((request) => (
                    <PurchaseRequestRow key={request.id_purchase_request} request={request} />
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
