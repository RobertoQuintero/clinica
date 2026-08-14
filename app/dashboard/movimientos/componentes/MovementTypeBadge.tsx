/**
 * Catálogo `inventory.movements` (ver queries.txt): se mapea aquí en vez de consultarlo,
 * igual que `OrderStatusBadge` con `inventory.order_statuses`. Los movimientos 3 y 4
 * (traspaso) se muestran con su nombre real y distinto de color según entrada/salida —
 * en el listado no se fusionan, solo en el select del modal (ver spec 14).
 */
const MOVEMENT_META: Record<number, { label: string; className: string }> = {
  1: {
    label: "Entrada por compra",
    className:
      "bg-[#e1f7e8] text-[#009c6b] border-[#c6f0d5] dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  },
  2: {
    label: "Salida por devolución",
    className:
      "bg-[#d3e4fe] text-[#0b1c30] border-[#c4c6d0] dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  },
  3: {
    label: "Entrada por traspaso",
    className:
      "bg-[#dbe1ff] text-[#003ea8] border-[#c4c6d0] dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
  4: {
    label: "Salida por traspaso",
    className:
      "bg-[#dbe1ff] text-[#003ea8] border-[#c4c6d0] dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
  5: {
    label: "Salida por consulta",
    className:
      "bg-[#f5f3ff] text-[#4c1d95] border-[#e0d7fb] dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  },
  6: {
    label: "Salida por venta",
    className:
      "bg-[#fff0e6] text-[#c2410c] border-[#ffd8cc] dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  },
  7: {
    label: "Entrada por ajuste",
    className:
      "bg-[#e1f7e8] text-[#009c6b] border-[#c6f0d5] dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  },
  8: {
    label: "Salida por ajuste",
    className:
      "bg-[#d3e4fe] text-[#0b1c30] border-[#c4c6d0] dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  },
  9: {
    label: "Salida por daño/merma",
    className:
      "bg-[#ffdad6] text-[#ba1a1a] border-[#ffb4ab] dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
};

interface Props {
  id_movement: number;
}

export default function MovementTypeBadge({ id_movement }: Props) {
  const meta = MOVEMENT_META[id_movement] ?? {
    label: "Desconocido",
    className:
      "bg-[#d3e4fe] text-[#44474f] border-[#c4c6d0] dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
