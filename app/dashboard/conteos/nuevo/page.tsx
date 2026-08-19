import NewCountForm from "./componentes/NewCountForm";

/**
 * Server Component: solo la cabecera estática. El formulario depende de
 * `SucursalContext` (sucursal seleccionada en el cliente), así que vive en un
 * componente cliente.
 */
export default function NuevoConteoPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">
          Nuevo conteo físico
        </h2>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Elige qué productos se van a contar. El stock del sistema no se muestra durante la captura.
        </p>
      </div>

      <NewCountForm />
    </div>
  );
}
