/**
 * Catálogo `inventory.order_statuses` (ver queries.txt): 1 Pedido, 2 Enviado, 3 Stock,
 * 4 Parcial, 5 Cancelado. Se mapea aquí en vez de consultarlo, igual que otros catálogos
 * pequeños y estables del repo (p. ej. los roles en proxy.ts).
 */
const STATUS_META: Record<number, { label: string; className: string }> = {
  1: {
    label: "Pedido",
    className:
      "bg-[#d3e4fe] text-[#0b1c30] border-[#c4c6d0] dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  },
  2: {
    label: "Enviado",
    className:
      "bg-[#fff0e6] text-[#c2410c] border-[#ffd8cc] dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  },
  3: {
    label: "Stock",
    className:
      "bg-[#e1f7e8] text-[#009c6b] border-[#c6f0d5] dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  },
  4: {
    label: "Parcial",
    className:
      "bg-[#f5f3ff] text-[#4c1d95] border-[#e0d7fb] dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  },
  5: {
    label: "Cancelado",
    className:
      "bg-[#ffdad6] text-[#ba1a1a] border-[#ffb4ab] dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
};

interface Props {
  id_status: number;
}

export default function OrderStatusBadge({ id_status }: Props) {
  const meta = STATUS_META[id_status] ?? {
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
