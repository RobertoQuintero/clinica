"use client";

import { IPago } from "@/interfaces/pago";
import { IMetodoPago } from "@/interfaces/metodo_pago";
import { EditarPagoData } from "../actions";
import React, { useRef, useState } from "react";
import { fmtDate } from "./helpers";

interface Props {
  pago:               IPago;
  metodoPagoOptions:  IMetodoPago[];
  canDelete:          boolean;
  onEliminar:         (id_pago: number) => void;
  deletingId:         number | null;
  canEdit:            boolean;
  onEditar:           (id_pago: number, data: EditarPagoData) => Promise<void>;
}

export default function PagoFila({ pago, metodoPagoOptions, canDelete, onEliminar, deletingId, canEdit, onEditar }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showEdit,    setShowEdit   ] = useState(false);
  const [editForm,    setEditForm   ] = useState<EditarPagoData>({
    monto:        pago.monto,
    idMetodoPago: pago.idMetodoPago,
    fecha_pago:   String(pago.fecha_pago ?? "").slice(0, 10),
    referencia:   pago.referencia,
  });
  const [editSaving,  setEditSaving ] = useState(false);
  const [editError,   setEditError  ] = useState<string | null>(null);

  // método de pago combobox state
  const [mpSearch, setMpSearch] = useState(
    () => metodoPagoOptions.find((m) => m.idMetodoPago === pago.idMetodoPago)?.descripcion ?? "",
  );
  const [mpOpen,   setMpOpen  ] = useState(false);
  const mpRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mpRef.current && !mpRef.current.contains(e.target as Node)) setMpOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredMp = metodoPagoOptions.filter((m) =>
    m.descripcion.toLowerCase().includes(mpSearch.toLowerCase()) ||
    m.clave.toLowerCase().includes(mpSearch.toLowerCase()),
  );

  const openEdit = () => {
    const mp = metodoPagoOptions.find((m) => m.idMetodoPago === pago.idMetodoPago);
    setEditForm({
      monto:        pago.monto,
      idMetodoPago: pago.idMetodoPago,
      fecha_pago:   String(pago.fecha_pago ?? "").slice(0, 10),
      referencia:   pago.referencia,
    });
    setMpSearch(mp?.descripcion ?? "");
    setEditError(null);
    setShowEdit(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.idMetodoPago) { setEditError("Selecciona un método de pago"); return; }
    setEditSaving(true);
    setEditError(null);
    try {
      await onEditar(pago.id_pago, editForm);
      setShowEdit(false);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setEditSaving(false);
    }
  };

  const isDeleting = deletingId === pago.id_pago;
  const eliminado  = !pago.status;

  return (
    <>
      <tr className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${eliminado ? "opacity-60" : ""}`}>
        <td className="px-4 py-3 text-zinc-500">{pago.id_pago}</td>
        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">{fmtDate(pago.fecha_pago)}</td>
        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 capitalize">
          {metodoPagoOptions.find((m) => m.idMetodoPago === pago.idMetodoPago)?.descripcion ?? "—"}
        </td>
        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 font-medium">
          ${Number(pago.monto).toFixed(2)}
        </td>
        <td className="px-4 py-3 text-zinc-500">{pago.referencia || "—"}</td>
        <td className="px-4 py-3">
          {eliminado ? (
            <span className="text-xs text-red-500 dark:text-red-400">
              Eliminado por {pago.nombre_usuario_elimino ?? "—"}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={openEdit}
                  className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:text-blue-400 transition-colors"
                >
                  Editar
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setShowConfirm(true)}
                  disabled={isDeleting}
                  className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-red-400 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? "..." : "Eliminar"}
                </button>
              )}
            </div>
          )}
        </td>
      </tr>

      {/* confirm modal */}
      {showConfirm && (
        <tr>
          <td colSpan={6} className="p-0">
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-2">
                  ¿Eliminar pago #{pago.id_pago}?
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">
                  El registro quedará marcado como eliminado y se mostrará quién lo eliminó. No se puede deshacer.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowConfirm(false); onEliminar(pago.id_pago); }}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}

      {/* edit modal */}
      {showEdit && (
        <tr>
          <td colSpan={6} className="p-0">
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-4">
                  Editar pago #{pago.id_pago}
                </h2>

                {editError && (
                  <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                    {editError}
                  </p>
                )}

                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Monto</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={editForm.monto}
                        onChange={(e) => setEditForm((f) => ({ ...f, monto: Number(e.target.value) }))}
                        required
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Fecha de pago</label>
                      <input
                        type="date"
                        value={editForm.fecha_pago}
                        onChange={(e) => setEditForm((f) => ({ ...f, fecha_pago: e.target.value }))}
                        required
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Método de pago</label>
                      <div ref={mpRef} className="relative">
                        <input
                          type="text"
                          autoComplete="off"
                          value={mpSearch}
                          onFocus={() => setMpOpen(true)}
                          onChange={(e) => {
                            setMpSearch(e.target.value);
                            setMpOpen(true);
                            setEditForm((f) => ({ ...f, idMetodoPago: 0 }));
                          }}
                          placeholder="Buscar método..."
                          required
                          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                        />
                        {mpOpen && filteredMp.length > 0 && (
                          <ul className="absolute z-20 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-600 dark:bg-zinc-800 max-h-40 overflow-y-auto text-sm">
                            {filteredMp.map((m) => (
                              <li
                                key={m.idMetodoPago}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setMpSearch(m.descripcion);
                                  setMpOpen(false);
                                  setEditForm((f) => ({ ...f, idMetodoPago: m.idMetodoPago }));
                                }}
                                className="cursor-pointer px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100"
                              >
                                <span className="font-medium">{m.descripcion}</span>
                                <span className="ml-2 text-xs text-zinc-400">{m.clave}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {mpOpen && filteredMp.length === 0 && mpSearch.length > 0 && (
                          <div className="absolute z-20 mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800">
                            Sin resultados
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Referencia</label>
                      <input
                        type="text"
                        value={editForm.referencia}
                        onChange={(e) => setEditForm((f) => ({ ...f, referencia: e.target.value }))}
                        placeholder="Opcional"
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowEdit(false)}
                      disabled={editSaving}
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={editSaving}
                      className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 disabled:opacity-50 transition-colors"
                    >
                      {editSaving ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
