import NewRequestForm from "./componentes/NewRequestForm";

/**
 * Server Component: solo la cabecera estática. El formulario depende de
 * `SucursalContext` (sucursal seleccionada en el cliente), así que vive en un
 * componente cliente (mismo patrón que `conteos/nuevo`).
 */
export default function NuevaSolicitudPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">
          Nueva solicitud de productos
        </h2>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Elige los productos y cantidades que necesitas. Compras se encarga del proveedor y el precio.
        </p>
      </div>

      <NewRequestForm />
    </div>
  );
}
