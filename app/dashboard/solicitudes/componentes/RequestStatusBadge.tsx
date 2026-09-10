import { PURCHASE_REQUEST_STATUS, PurchaseRequestStatusId } from "@/interfaces/purchase_request";

/** Estados de `PURCHASE_REQUEST_STATUS` (constantes en código, ver interfaces/purchase_request.ts). */
const STATUS_META: Record<PurchaseRequestStatusId, { label: string; className: string }> = {
  [PURCHASE_REQUEST_STATUS.PENDING]: {
    label: "Pendiente",
    className:
      "bg-[#d3e4fe] text-[#0b1c30] border-[#c4c6d0] dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  },
  [PURCHASE_REQUEST_STATUS.CONFIRMED]: {
    label: "Confirmada",
    className:
      "bg-[#e1f7e8] text-[#009c6b] border-[#c6f0d5] dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  },
  [PURCHASE_REQUEST_STATUS.REJECTED]: {
    label: "Rechazada",
    className:
      "bg-[#ffdad6] text-[#ba1a1a] border-[#ffb4ab] dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
  [PURCHASE_REQUEST_STATUS.CANCELLED]: {
    label: "Cancelada",
    className:
      "bg-[#eceef1] text-[#44474f] border-[#c4c6d0] dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  },
};

interface Props {
  id_status_request: PurchaseRequestStatusId;
}

export default function RequestStatusBadge({ id_status_request }: Props) {
  const meta = STATUS_META[id_status_request];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
