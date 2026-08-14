interface Props {
  folios: string[];
}

/**
 * Indicador informativo de que el producto ya tiene al menos una orden de
 * compra abierta (Pedido/Enviado/Parcial) con línea pendiente de recibir.
 * No bloquea ni navega — solo advierte para evitar duplicar la solicitud.
 * El padre controla la visibilidad vía `has_pending_order`; si `folios`
 * llega vacío, no se renderiza nada.
 */
export default function PendingOrderBadge({ folios }: Props) {
  if (folios.length === 0) return null;

  return (
    <span
      title={folios.join(", ")}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 whitespace-nowrap"
    >
      Pedido pendiente
    </span>
  );
}
