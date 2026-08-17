"use client";

import { Package, Pencil, Trash2, ArrowRight } from "lucide-react";
import { IPurchaseOrderTemplateListItem } from "@/interfaces/purchase_order_template";
import { dayFirst } from "@/utils/date_helpper";

interface Props {
  template: IPurchaseOrderTemplateListItem;
  onEdit:   (template: IPurchaseOrderTemplateListItem) => void;
  onDelete: (template: IPurchaseOrderTemplateListItem) => void;
  onUse:    (template: IPurchaseOrderTemplateListItem) => void;
}

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export default function OrderTemplateCard({ template, onEdit, onDelete, onUse }: Props) {
  // El string de BD viene "YYYY-MM-DD HH:mm:ss": se normaliza a "T" antes de
  // formatear, nunca se llama new Date(raw) directo (ver CLAUDE.md).
  const lastUpdated = dayFirst(template.updated_at.replace(" ", "T"));

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-6 flex flex-col justify-between hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors">
      <div>
        <h2 className="text-base font-semibold text-[#0b1c30] dark:text-zinc-100 mb-2">
          {template.name}
        </h2>
        <p className="flex items-center gap-1 text-sm text-[#44474f] dark:text-zinc-400 mb-6">
          <Package size={16} />
          {template.items_count} {template.items_count === 1 ? "producto" : "productos"} • Última actualización: {lastUpdated}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center pt-4 border-t border-[#c4c6d0] dark:border-zinc-700 gap-4">
        <div className="flex flex-col w-full sm:w-auto">
          <span className="text-xs font-medium text-[#44474f] dark:text-zinc-400">Valor Estimado</span>
          <span className="text-base font-semibold text-[#0b1c30] dark:text-zinc-100">
            {currencyFormatter.format(template.estimated_value)}
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => onEdit(template)}
            title="Editar"
            className="p-2 text-[#44474f] dark:text-zinc-400 hover:text-[#0051d5] dark:hover:text-blue-400 transition-colors"
          >
            <Pencil size={18} />
          </button>
          <button
            onClick={() => onDelete(template)}
            title="Eliminar"
            className="p-2 text-[#44474f] dark:text-zinc-400 hover:text-[#ba1a1a] dark:hover:text-red-400 transition-colors"
          >
            <Trash2 size={18} />
          </button>
          <button
            onClick={() => onUse(template)}
            className="bg-[#eff4ff] dark:bg-zinc-800 text-[#0051d5] dark:text-blue-400 text-sm font-semibold py-2 px-4 rounded-lg hover:bg-[#d7e3ff] dark:hover:bg-zinc-700 transition-colors flex items-center gap-2"
          >
            Usar para Pedido <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
