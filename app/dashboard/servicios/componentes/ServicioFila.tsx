"use client";

import { IServicio } from "@/interfaces/servicio";
import { deleteServicio } from "../actions";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "./ConfirmModal";

interface Props {
  servicio: IServicio;
  onEdit: (s: IServicio) => void;
  onDeleted: () => void;
}

export default function ServicioFila({ servicio: s, onEdit, onDeleted }: Props) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    setDeleting(true);
    setErrorMsg(null);
    const res = await deleteServicio(s.id_servicio);
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
        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{s.nombre}</td>
        <td className="px-4 py-3 flex gap-2 justify-end">
          <button
            onClick={() => onEdit(s)}
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
          <button
            onClick={() => router.push(`/dashboard/servicios/${s.id_servicio}/opciones`)}
            className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
            title="Ver opciones"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
          </button>
        </td>
      </tr>

      {showConfirm && (
        <ConfirmModal
          message={`¿Deseas eliminar el servicio "${s.nombre}"? Esta acción no se puede deshacer.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowConfirm(false)}
          loading={deleting}
          error={errorMsg}
        />
      )}
    </>
  );
}
