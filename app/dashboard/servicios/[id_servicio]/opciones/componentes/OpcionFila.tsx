"use client";

import { IServicioOpcion } from "@/interfaces/servicio_opcion";
import { deleteOpcionServicio } from "../actions";
import { useState } from "react";
import ConfirmModal from "../../../componentes/ConfirmModal";

interface Props {
  opcion: IServicioOpcion;
  onEdit: (o: IServicioOpcion) => void;
  onDeleted: () => void;
}

export default function OpcionFila({ opcion: o, onEdit, onDeleted }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    setDeleting(true);
    setErrorMsg(null);
    const res = await deleteOpcionServicio(o.id_servicio_opcion, o.id_servicio);
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
      <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{o.nombre}</td>
        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{o.descripcion}</td>
        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">
          ${Number(o.precio).toFixed(2)}
        </td>
        <td className="px-4 py-3 flex gap-2 justify-end">
          <button
            onClick={() => onEdit(o)}
            className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
          >
            Editar
          </button>
          <button
            onClick={() => { setErrorMsg(null); setShowConfirm(true); }}
            className="rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/70 transition-colors"
          >
            Eliminar
          </button>
        </td>
      </tr>

      {showConfirm && (
        <ConfirmModal
          message={`¿Deseas eliminar la opción "${o.descripcion}"? Esta acción no se puede deshacer.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowConfirm(false)}
          loading={deleting}
          error={errorMsg}
        />
      )}
    </>
  );
}
