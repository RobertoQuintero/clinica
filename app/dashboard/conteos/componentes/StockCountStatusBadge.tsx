import { StockCountStatus } from "@/interfaces/stock_count";

/**
 * Estados de `inventory.stock_counts` (ver queries.txt). Se mapea aquí en vez de
 * consultarlo, igual que `OrderStatusBadge`/`MovementTypeBadge`.
 */
const STATUS_META: Record<StockCountStatus, { label: string; className: string }> = {
  en_captura: {
    label: "En captura",
    className:
      "bg-[#dbe1ff] text-[#003ea8] border-[#c4c6d0] dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
  segundo_conteo: {
    label: "Segundo conteo",
    className:
      "bg-[#fff0e6] text-[#c2410c] border-[#ffd8cc] dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  },
  pendiente_revision: {
    label: "Pendiente de revisión",
    className:
      "bg-[#f5f3ff] text-[#4c1d95] border-[#e0d7fb] dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  },
  cerrado: {
    label: "Cerrado",
    className:
      "bg-[#e1f7e8] text-[#009c6b] border-[#c6f0d5] dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  },
  cancelado: {
    label: "Cancelado",
    className:
      "bg-[#ffdad6] text-[#ba1a1a] border-[#ffb4ab] dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
};

interface Props {
  status: StockCountStatus;
}

export default function StockCountStatusBadge({ status }: Props) {
  const meta = STATUS_META[status] ?? {
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
