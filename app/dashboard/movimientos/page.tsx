import RegisterMovementModal from "./componentes/RegisterMovementModal";
import StockMovementsTable from "./componentes/StockMovementsTable";

/**
 * Server Component: solo renderiza la cabecera estática. Los datos dependen de
 * `SucursalContext` (sucursal seleccionada en el cliente), así que el listado y
 * el modal de captura viven en componentes cliente (igual que /dashboard/recepciones).
 */
export default function MovimientosPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">
            Movimientos de almacén
          </h2>
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            Consulta el kardex de la sucursal y registra ajustes, mermas, devoluciones y traspasos.
          </p>
        </div>
        <RegisterMovementModal />
      </div>

      <StockMovementsTable />
    </div>
  );
}
