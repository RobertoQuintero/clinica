"use client";

import { IReceptionLineDetail } from "../../actions";
import QuantityStepper from "@/app/dashboard/componentes/QuantityStepper";

interface Props {
  line:         IReceptionLineDetail;
  quantityNow:  number;
  onChange:     (quantity: number) => void;
}

type LineStatus = "completo" | "parcial" | "pendiente";

const STATUS_META: Record<LineStatus, { label: string; className: string }> = {
  completo: {
    label: "Completo",
    className:
      "bg-[#e1f7e8] text-[#009c6b] dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  parcial: {
    label: "Parcial",
    className: "bg-[#ffdad6] text-[#ba1a1a] dark:bg-red-900/30 dark:text-red-400",
  },
  pendiente: {
    label: "Pendiente",
    className:
      "bg-[#d3e4fe] text-[#44474f] dark:bg-zinc-800 dark:text-zinc-400",
  },
};

export default function ReceptionLineRow({ line, quantityNow, onChange }: Props) {
  const alreadyClosed = line.quantity_pending === 0;
  const status: LineStatus = alreadyClosed
    ? "completo"
    : quantityNow === 0
    ? "pendiente"
    : quantityNow === line.quantity_pending
    ? "completo"
    : "parcial";
  const difference = quantityNow - line.quantity_pending;

  return (
    <tr className="hover:bg-[#eff4ff]/50 dark:hover:bg-zinc-800/50 transition-colors">
      <td className="p-4">
        <p className="font-medium text-[#0b1c30] dark:text-zinc-100">{line.product_name}</p>
        <p className="text-xs text-[#44474f] dark:text-zinc-400 mt-0.5">
          {line.product_code || "—"}
          {line.quantity_received > 0 ? ` • Ya recibido: ${line.quantity_received}` : ""}
        </p>
      </td>
      <td className="p-4 text-center text-[#0b1c30] dark:text-zinc-100">{line.quantity}</td>
      <td className="p-4">
        <div className="flex justify-center">
          <QuantityStepper
            value={quantityNow}
            min={0}
            max={line.quantity_pending}
            disabled={alreadyClosed}
            onChange={onChange}
          />
        </div>
      </td>
      <td className="p-4 text-center">
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium ${STATUS_META[status].className}`}
        >
          {STATUS_META[status].label}
        </span>
      </td>
      <td
        className={`p-4 text-right ${
          difference < 0
            ? "text-[#ba1a1a] dark:text-red-400 font-medium"
            : "text-[#44474f] dark:text-zinc-400"
        }`}
      >
        {difference}
      </td>
    </tr>
  );
}
