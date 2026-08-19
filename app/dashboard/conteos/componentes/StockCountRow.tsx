import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { IStockCountListItem } from "../actions";
import StockCountStatusBadge from "./StockCountStatusBadge";

interface Props {
  item:         IStockCountListItem;
  isSupervisor: boolean;
}

/** Etiqueta + destino de la acción contextual, según estado y rol de quien mira el listado. */
function getRowAction(item: IStockCountListItem, isSupervisor: boolean): { label: string; href: string } {
  const entryHref = `/dashboard/conteos/${item.id_stock_count}`;
  const reviewHref = `/dashboard/conteos/${item.id_stock_count}/revision`;

  switch (item.status) {
    case "en_captura":
      return { label: "Continuar captura", href: entryHref };
    case "segundo_conteo":
      return { label: "Segundo conteo", href: entryHref };
    case "pendiente_revision":
      return isSupervisor ? { label: "Revisar", href: reviewHref } : { label: "Ver", href: entryHref };
    case "cerrado":
    case "cancelado":
    default:
      return isSupervisor ? { label: "Ver", href: reviewHref } : { label: "Ver", href: entryHref };
  }
}

export default function StockCountRow({ item, isSupervisor }: Props) {
  const action = getRowAction(item, isSupervisor);
  const typeLabel =
    item.count_type === "general" ? "General" : `Categoría · ${item.category_name ?? "—"}`;

  return (
    <tr className="border-b border-[#c4c6d0] dark:border-zinc-700 last:border-b-0 hover:bg-[#eff4ff]/60 dark:hover:bg-zinc-800/60 transition-colors">
      <td className="px-6 py-4 font-semibold text-[#0b1c30] dark:text-zinc-50">{item.folio}</td>
      <td className="px-6 py-4 text-[#0b1c30] dark:text-zinc-100">{typeLabel}</td>
      <td className="px-6 py-4 text-[#0b1c30] dark:text-zinc-100">{item.counter_name}</td>
      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">{item.created_at}</td>
      <td className="px-6 py-4">
        <StockCountStatusBadge status={item.status} />
      </td>
      <td className="px-6 py-4 text-right">
        <Link
          href={action.href}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#0051d5] dark:text-blue-400 hover:underline"
        >
          {action.label}
          <ChevronRight size={16} />
        </Link>
      </td>
    </tr>
  );
}
