"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { IPurchaseOrderListItem } from "../actions";
import OrderStatusBadge from "@/app/dashboard/componentes/OrderStatusBadge";
import { dayFirst } from "@/utils/date_helpper";

interface Props {
  order: IPurchaseOrderListItem;
}

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export default function PurchaseOrderRow({ order }: Props) {
  const router = useRouter();

  return (
    <tr
      onClick={() => router.push(`/dashboard/pedidos/${order.id_purchase_order}`)}
      className="border-b border-[#c4c6d0] dark:border-zinc-700 hover:bg-[#eff4ff]/50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
    >
      <td className="px-6 py-4 font-semibold text-[#0b1c30] dark:text-zinc-100">{order.folio}</td>
      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">{order.supplier_name}</td>
      <td className="px-6 py-4">
        <OrderStatusBadge id_status={order.id_status} />
      </td>
      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">
        {order.created_at ? dayFirst(String(order.created_at).replace(" ", "T")) : "—"}
      </td>
      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">
        {order.estimated_date ? dayFirst(order.estimated_date + "T00:00:00") : "—"}
      </td>
      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">
        {order.metodo_pago_descripcion ?? "—"}
      </td>
      <td className="px-6 py-4 text-right font-medium text-[#0b1c30] dark:text-zinc-100">
        {currencyFormatter.format(order.total)}
      </td>
      <td className="px-6 py-4 text-right">
        <ChevronRight size={18} className="text-[#44474f] dark:text-zinc-400 inline-block" />
      </td>
    </tr>
  );
}
