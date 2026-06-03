"use client";

import { useEffect, useState } from "react";
import {
  getPagosByTratamiento,
  getMetodosPagoTratamiento,
  getDefaultTotalTipo2,
  createPagoTratamiento,
  deletePagoTratamiento,
  updatePagoTratamiento,
  IPagoTratamientoRow,
} from "@/app/dashboard/tratamientos/actions";
import ConfirmModal from "@/app/dashboard/componentes/ConfirmModal";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  id_tratamiento: number;
}

const fmtDatetime = (val: string) => {
  if (!val) return "—";
  return new Date(String(val).replace(" ", "T"))
    .toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
};

export default function AccordionPagos({ id_tratamiento }: Props) {
  const { user } = useAuth();
  const canEdit  = user?.id_role === 1 || user?.id_role === 4;

  const [open, setOpen] = useState(true);

  const [pagos, setPagos]               = useState<IPagoTratamientoRow[]>([]);
  const [metodos, setMetodos]           = useState<{ idMetodoPago: number; descripcion: string }[]>([]);
  const [defaultTotal, setDefaultTotal] = useState(0);
  const [loadingData, setLoadingData]   = useState(true);

  // Add payment form
  const [addingPago, setAddingPago]   = useState(false);
  const [savingPago, setSavingPago]   = useState(false);
  const [pagoError, setPagoError]     = useState("");
  const [pagoForm, setPagoForm]       = useState({ total: 0, idMetodoPago: 0, referencia: "" });

  // Edit payment
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [editForm, setEditForm]       = useState({ total: 0, idMetodoPago: 0, referencia: "" });
  const [savingEdit, setSavingEdit]   = useState(false);
  const [editError, setEditError]     = useState("");

  // Delete payment
  const [deleteId, setDeleteId]       = useState<number | null>(null);
  const [deletingPago, setDeletingPago] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    Promise.all([
      getPagosByTratamiento(id_tratamiento),
      getMetodosPagoTratamiento(),
      getDefaultTotalTipo2(),
    ]).then(([payments, mets, defTotal]) => {
      setPagos(payments);
      setMetodos(mets);
      setDefaultTotal(defTotal);
      setPagoForm({ total: defTotal, idMetodoPago: mets[0]?.idMetodoPago ?? 0, referencia: "" });
      setLoadingData(false);
    });
  }, [id_tratamiento]);

  const handleAddPago = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPago(true);
    setPagoError("");
    const result = await createPagoTratamiento({
      id_tratamiento,
      total:        pagoForm.total,
      idMetodoPago: pagoForm.idMetodoPago,
      referencia:   pagoForm.referencia,
    });
    if (result.ok) {
      const updated = await getPagosByTratamiento(id_tratamiento);
      setPagos(updated);
      setPagoForm({ total: defaultTotal, idMetodoPago: metodos[0]?.idMetodoPago ?? 0, referencia: "" });
      setAddingPago(false);
    } else {
      setPagoError(result.message ?? "Error al guardar");
    }
    setSavingPago(false);
  };

  const openEdit = (p: IPagoTratamientoRow) => {
    setEditingId(p.id_tratamiento_pago);
    setEditForm({ total: Number(p.total), idMetodoPago: p.idMetodoPago, referencia: p.referencia });
    setEditError("");
  };

  const handleEditPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId === null) return;
    setSavingEdit(true);
    setEditError("");
    const result = await updatePagoTratamiento({
      id_tratamiento_pago: editingId,
      total:               editForm.total,
      idMetodoPago:        editForm.idMetodoPago,
      referencia:          editForm.referencia,
    });
    if (result.ok) {
      const updated = await getPagosByTratamiento(id_tratamiento);
      setPagos(updated);
      setEditingId(null);
    } else {
      setEditError(result.message ?? "Error al actualizar");
    }
    setSavingEdit(false);
  };

  const handleDeleteConfirm = async () => {
    if (deleteId === null) return;
    setDeletingPago(true);
    setDeleteError("");
    const result = await deletePagoTratamiento(deleteId);
    if (result.ok) {
      const updated = await getPagosByTratamiento(id_tratamiento);
      setPagos(updated);
      setDeleteId(null);
    } else {
      setDeleteError(result.message ?? "Error al eliminar");
    }
    setDeletingPago(false);
  };

  return (
    <>
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-4 text-left"
        >
          <span className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
            Pagos
          </span>
          <svg
            className={`h-4 w-4 text-zinc-500 transition-transform dark:text-zinc-400 ${open ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {open && (
          <div className="px-6 pb-6">
            {loadingData ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando pagos…</p>
            ) : (
              <>
                {/* Payments table */}
                {pagos.length > 0 ? (
                  <div className="mb-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
                      <thead className="bg-zinc-50 dark:bg-zinc-800">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Fecha
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Tipo
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Total
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Método de pago
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Referencia
                          </th>
                          {canEdit && (
                            <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                              Acciones
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                        {pagos.map((p) =>
                          editingId === p.id_tratamiento_pago ? (
                            /* ── Edit row ── */
                            <tr key={p.id_tratamiento_pago}>
                              <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300" colSpan={2}>
                                {fmtDatetime(p.created_at)}
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  required
                                  value={editForm.total}
                                  onChange={(e) => setEditForm((f) => ({ ...f, total: Number(e.target.value) }))}
                                  className="w-28 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <select
                                  required
                                  value={editForm.idMetodoPago}
                                  onChange={(e) => setEditForm((f) => ({ ...f, idMetodoPago: Number(e.target.value) }))}
                                  className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                                >
                                  {metodos.map((m) => (
                                    <option key={m.idMetodoPago} value={m.idMetodoPago}>
                                      {m.descripcion}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={editForm.referencia}
                                  onChange={(e) => setEditForm((f) => ({ ...f, referencia: e.target.value }))}
                                  className="w-32 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={handleEditPago}
                                    disabled={savingEdit}
                                    className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                  >
                                    {savingEdit ? "…" : "Guardar"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setEditingId(null); setEditError(""); }}
                                    className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                                {editError && (
                                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{editError}</p>
                                )}
                              </td>
                            </tr>
                          ) : (
                            /* ── Normal row ── */
                            <tr key={p.id_tratamiento_pago}>
                              <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                                {fmtDatetime(p.created_at)}
                              </td>
                              <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                                {p.nombre_tipo}
                              </td>
                              <td className="px-4 py-2 text-right font-medium text-zinc-800 dark:text-zinc-100">
                                ${Number(p.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                                {p.nombre_metodo}
                              </td>
                              <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                                {p.referencia || "—"}
                              </td>
                              {canEdit && (
                                <td className="px-4 py-2">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => openEdit(p)}
                                      className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => { setDeleteId(p.id_tratamiento_pago); setDeleteError(""); }}
                                      className="rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">Sin pagos registrados.</p>
                )}

                {/* Add payment */}
                {!addingPago ? (
                  <button
                    onClick={() => setAddingPago(true)}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors"
                  >
                    + Agregar pago
                  </button>
                ) : (
                  <form
                    onSubmit={handleAddPago}
                    className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Nuevo pago
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                          Total
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={pagoForm.total}
                          onChange={(e) => setPagoForm((f) => ({ ...f, total: Number(e.target.value) }))}
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                          Método de pago
                        </label>
                        <select
                          required
                          value={pagoForm.idMetodoPago}
                          onChange={(e) => setPagoForm((f) => ({ ...f, idMetodoPago: Number(e.target.value) }))}
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                          <option value={0} disabled>Seleccionar…</option>
                          {metodos.map((m) => (
                            <option key={m.idMetodoPago} value={m.idMetodoPago}>
                              {m.descripcion}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                          Referencia
                        </label>
                        <input
                          type="text"
                          value={pagoForm.referencia}
                          onChange={(e) => setPagoForm((f) => ({ ...f, referencia: e.target.value }))}
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    </div>
                    {pagoError && (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-400">{pagoError}</p>
                    )}
                    <div className="mt-4 flex gap-2">
                      <button
                        type="submit"
                        disabled={savingPago}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors"
                      >
                        {savingPago ? "Guardando…" : "Guardar pago"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAddingPago(false); setPagoError(""); }}
                        className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteId !== null && (
        <ConfirmModal
          message="¿Eliminar este pago? Esta acción no se puede deshacer."
          loading={deletingPago}
          error={deleteError || null}
          onConfirm={handleDeleteConfirm}
          onCancel={() => { setDeleteId(null); setDeleteError(""); }}
        />
      )}
    </>
  );
}
