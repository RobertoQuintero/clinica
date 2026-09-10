"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { IPurchaseRequestListItem } from "@/interfaces/purchase_request";
import RequestStatusBadge from "./RequestStatusBadge";
import { dayFirst } from "@/utils/date_helpper";

interface Props {
  request: IPurchaseRequestListItem;
}

export default function PurchaseRequestRow({ request }: Props) {
  const router = useRouter();

  return (
    <tr
      onClick={() => router.push(`/dashboard/solicitudes/${request.id_purchase_request}`)}
      className="border-b border-[#c4c6d0] dark:border-zinc-700 hover:bg-[#eff4ff]/50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
    >
      <td className="px-6 py-4 font-semibold text-[#0b1c30] dark:text-zinc-100">{request.folio}</td>
      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">{request.created_by_name}</td>
      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">
        {request.created_at ? dayFirst(String(request.created_at).replace(" ", "T")) : "—"}
      </td>
      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">
        {request.items_count} producto{request.items_count === 1 ? "" : "s"}
      </td>
      <td className="px-6 py-4">
        <RequestStatusBadge id_status_request={request.id_status_request} />
      </td>
      <td className="px-6 py-4 text-right">
        <ChevronRight size={18} className="text-[#44474f] dark:text-zinc-400 inline-block" />
      </td>
    </tr>
  );
}
