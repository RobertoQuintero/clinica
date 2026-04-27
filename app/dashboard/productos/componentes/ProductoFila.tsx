"use client";

import { IProducto } from "@/interfaces/producto";
import { deleteProducto } from "../actions";
import { useState } from "react";
import ConfirmModal from "@/app/dashboard/componentes/ConfirmModal";

interface Props {
  producto: IProducto;
  onEdit: (p: IProducto) => void;
  onDeleted: () => void;
  readOnly?: boolean;
}

export default function ProductoFila({ producto: p, onEdit, onDeleted, readOnly }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    setDeleting(true);
    setErrorMsg(null);
    const res = await deleteProducto(p.id_producto);
    if (res.ok) {
      setShowConfirm(false);
      onDeleted();
    } else {
      setErrorMsg(res.message ?? "Error al eliminar");
      setDeleting(false);
    }
  };

  const fmtPrecio = (val: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);

  return (
    <>
      <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.nombre}</td>
        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{fmtPrecio(p.precio)}</td>
        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 max-w-xs truncate">{p.descripcion || "—"}</td>
        <td className="px-4 py-3 flex gap-2 justify-end">
          {!readOnly && (
            <button
              onClick={() => onEdit(p)}
              className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
            >
              Editar
            </button>
          )}
          {!readOnly && (
            <button
              onClick={() => { setErrorMsg(null); setShowConfirm(true); }}
              className="rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/70 transition-colors"
            >
              Eliminar
            </button>
          )}
        </td>
      </tr>

      {showConfirm && (
        <ConfirmModal
          message={`¿Deseas eliminar el producto "${p.nombre}"? Esta acción no se puede deshacer.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowConfirm(false)}
          loading={deleting}
          error={errorMsg}
        />
      )}
    </>
  );
}
