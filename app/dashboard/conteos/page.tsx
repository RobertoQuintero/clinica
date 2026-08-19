import Link from "next/link";
import { Plus } from "lucide-react";
import StockCountsTable from "./componentes/StockCountsTable";

/**
 * Server Component: solo renderiza la cabecera estática. El listado depende de
 * `SucursalContext` (sucursal seleccionada en el cliente), así que vive en un
 * componente cliente (igual que /dashboard/movimientos y /dashboard/pedidos).
 */
export default function ConteosPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">
            Conteos físicos de inventario
          </h2>
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            Genera conteos, captura las cantidades contadas y autoriza los ajustes de stock.
          </p>
        </div>
        <Link
          href="/dashboard/conteos/nuevo"
          className="flex items-center gap-2 rounded-lg bg-[#0051d5] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90"
        >
          <Plus size={18} />
          Nuevo conteo
        </Link>
      </div>

      <StockCountsTable />
    </div>
  );
}
