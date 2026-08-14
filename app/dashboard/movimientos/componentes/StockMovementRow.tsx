"use client";

import { IStockMovementListItem } from "../actions";
import MovementTypeBadge from "./MovementTypeBadge";

interface Props {
  movement: IStockMovementListItem;
}

/** Nunca se parsea la cadena de la BD directo con `new Date(...)`: se normaliza el
 * separador (" " → "T") para que el navegador la interprete en hora local. */
function formatDateTime(dbValue: string): string {
  return new Date(dbValue.replace(" ", "T")).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function StockMovementRow({ movement }: Props) {
  const isEntry = movement.increases_storage;
  const isMerma = movement.id_movement === 9;
  const quantityClassName = isEntry
    ? "text-[#009c6b] dark:text-emerald-400"
    : isMerma
      ? "text-[#ba1a1a] dark:text-red-400"
      : "text-[#0b1c30] dark:text-zinc-100";

  return (
    <tr className="border-b border-[#c4c6d0] dark:border-zinc-700 hover:bg-[#eff4ff]/50 dark:hover:bg-zinc-800/50 transition-colors">
      <td className="px-6 py-4 font-semibold text-[#0b1c30] dark:text-zinc-100 whitespace-nowrap">
        MOV-{movement.id_kardex}
      </td>
      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400 whitespace-nowrap">
        {formatDateTime(movement.created_at)}
      </td>
      <td className="px-6 py-4">
        <MovementTypeBadge id_movement={movement.id_movement} />
      </td>
      <td className="px-6 py-4">
        <div className="text-[#0b1c30] dark:text-zinc-100 font-medium">{movement.product_name}</div>
        <div className="text-[#747780] dark:text-zinc-500 text-xs">{movement.product_code}</div>
      </td>
      <td className={`px-6 py-4 text-right font-semibold whitespace-nowrap ${quantityClassName}`}>
        {isEntry ? "+" : "−"} {movement.quantity}
        {movement.unit_code ? ` ${movement.unit_code}` : ""}
      </td>
      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">
        {movement.counterpart_name ?? "—"}
      </td>
      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">{movement.user_name}</td>
      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400 max-w-[220px] truncate">
        {movement.notes ?? "—"}
      </td>
    </tr>
  );
}
