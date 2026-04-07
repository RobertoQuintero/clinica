"use client";

import { useState, useTransition } from "react";
import ConfirmModal from "@/app/dashboard/componentes/ConfirmModal";
import {
  deleteConsultaProducto,
  updateConsultaProducto,
  ConsultaProductoExtended,
} from "../actions";

interface Props {
  producto: ConsultaProductoExtended;
  onUpdate: (updated: ConsultaProductoExtended) => void;
  onDelete: (id: number) => void;
}

export default function ProductoRow({ producto, onUpdate, onDelete }: Props) {
  const [editing,       setEditing      ] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form,          setForm         ] = useState({
    precio:   producto.precio,
    cantidad: producto.cantidad,
    status:   producto.status,
  });
  const [error,     setError    ] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateConsultaProducto(
        producto.id_consulta_producto,
        Number(form.precio),
        Number(form.cantidad),
        form.status,
      );
      if (!res.ok) { setError(res.data); return; }
      onUpdate(res.data);
      setEditing(false);
    });
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setError(null);
    setForm({ precio: producto.precio, cantidad: producto.cantidad, status: producto.status });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteConsultaProducto(producto.id_consulta_producto);
      if (!res.ok) { setError(res.data); setConfirmDelete(false); return; }
      onDelete(producto.id_consulta_producto);
    });
  };

  const inputCls = "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400";

  if (editing) {
    return (
      <>
        <tr className="bg-zinc-50 dark:bg-zinc-800/50">
          <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">
            {producto.nombre_producto || `#${producto.id_producto}`}
          </td>
          <td className="px-4 py-3">
            <input
              type="number"
              min={1}
              className={`w-20 ${inputCls}`}
              value={form.cantidad}
              onChange={(e) => setForm((f) => ({ ...f, cantidad: Number(e.target.value) }))}
            />
          </td>
          <td className="px-4 py-3">
            <input
              type="number"
              min={0}
              step="0.01"
              className={`w-24 ${inputCls}`}
              value={form.precio}
              onChange={(e) => setForm((f) => ({ ...f, precio: Number(e.target.value) }))}
            />
          </td>
          <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">
            ${(Number(form.precio) * Number(form.cantidad)).toFixed(2)}
          </td>
          <td className="px-4 py-3">
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className={inputCls}
            >
              <option value="activo">activo</option>
              <option value="inactivo">inactivo</option>
            </select>
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleSave}
                disabled={isPending}
                className="rounded bg-zinc-800 px-3 py-1 text-xs text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-600 dark:hover:bg-zinc-500"
              >
                {isPending ? "..." : "Guardar"}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isPending}
                className="rounded px-3 py-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Cancelar
              </button>
              {error && <span className="text-xs text-red-500">{error}</span>}
            </div>
          </td>
        </tr>
      </>
    );
  }

  return (
    <>
      <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">
          {producto.nombre_producto || `#${producto.id_producto}`}
        </td>
        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{producto.cantidad}</td>
        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">${Number(producto.precio).toFixed(2)}</td>
        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">
          ${(Number(producto.precio) * Number(producto.cantidad)).toFixed(2)}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
            >
              Editar
            </button>
            <button
              onClick={() => { setError(null); setConfirmDelete(true); }}
              className="text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              Eliminar
            </button>
          </div>
        </td>
      </tr>

      {confirmDelete && (
        <ConfirmModal
          message={`¿Eliminar "${producto.nombre_producto || `#${producto.id_producto}`}" de la consulta?`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
          loading={isPending}
          error={error}
        />
      )}
    </>
  );
}
