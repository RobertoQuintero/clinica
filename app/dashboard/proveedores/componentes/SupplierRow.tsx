"use client";

import { ISupplier } from "@/interfaces/supplier";
import { deleteSupplier } from "../actions";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2 } from "lucide-react";
import ConfirmModal from "@/app/dashboard/componentes/ConfirmModal";

interface Props {
  supplier: ISupplier;
  onEdit: (supplier: ISupplier) => void;
  onDeleted: () => void;
}

export default function SupplierRow({ supplier, onEdit, onDeleted }: Props) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    setDeleting(true);
    setErrorMsg(null);
    const res = await deleteSupplier(supplier.id_proveedor);
    if (res.ok) {
      setShowConfirm(false);
      onDeleted();
    } else {
      setErrorMsg(res.message ?? "Error al eliminar");
      setDeleting(false);
    }
  };

  return (
    <>
      <tr className="border-b border-[#c4c6d0] dark:border-zinc-700 hover:bg-[#eff4ff]/50 dark:hover:bg-zinc-800/50 transition-colors">
        <td className="px-6 py-4 font-medium text-[#0b1c30] dark:text-zinc-100">{supplier.nombre_corto}</td>
        <td className="px-6 py-4 font-mono text-sm text-[#44474f] dark:text-zinc-400">{supplier.rfc || "—"}</td>
        <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">{supplier.telefono_principal || "—"}</td>
        <td className="px-6 py-4">
          {supplier.activo ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#009c6b]/10 text-[#009c6b] border border-[#009c6b]/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
              Activo
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#d3e4fe] text-[#44474f] border border-[#c4c6d0] dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
              Inactivo
            </span>
          )}
        </td>
        <td className="px-6 py-4 text-right">
          <div className="flex justify-end gap-1">
            <button
              onClick={() => router.push(`/dashboard/proveedores/${supplier.id_proveedor}`)}
              title="Ver detalle"
              className="p-2 rounded-full hover:bg-[#dce9ff] dark:hover:bg-zinc-700 text-[#44474f] dark:text-zinc-400 transition-colors"
            >
              <Eye size={18} />
            </button>
            <button
              onClick={() => onEdit(supplier)}
              title="Editar"
              className="p-2 rounded-full hover:bg-[#dce9ff] dark:hover:bg-zinc-700 text-[#44474f] dark:text-zinc-400 transition-colors"
            >
              <Pencil size={18} />
            </button>
            <button
              onClick={() => { setErrorMsg(null); setShowConfirm(true); }}
              title="Eliminar"
              className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 text-[#44474f] dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </td>
      </tr>

      {showConfirm && (
        <ConfirmModal
          message={`¿Deseas eliminar al proveedor "${supplier.nombre_corto}"? Esta acción no se puede deshacer.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowConfirm(false)}
          loading={deleting}
          error={errorMsg}
        />
      )}
    </>
  );
}
