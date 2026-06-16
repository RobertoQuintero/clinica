"use client";

import React, { useState } from "react";
import {
  updateEgreso,
  deleteEgreso,
  IEgresoRow,
} from "@/app/dashboard/tratamientos/actions";
import ConfirmModal from "@/app/dashboard/componentes/ConfirmModal";
import { useAuth } from "@/contexts/AuthContext";
import EgresoForm, { EgresoFormValues } from "./EgresoForm";
import EgresoArchivos from "./EgresoArchivos";

const fmtDatetime = (val: string) => {
  if (!val) return "—";
  return new Date(String(val).replace(" ", "T"))
    .toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
};

// ─── EgresoItem ───────────────────────────────────────────────────────────────

export interface EgresoItemProps {
  eg:           IEgresoRow;
  tipos:        { id_egreso_tipo: number; name: string }[];
  stages:       { id_egreso_stage: number; name: string }[];
  metodos:      { idMetodoPago: number; descripcion: string }[];
  canEditStage: boolean;
  onDeleted:    (id_egreso: number) => void;
  onUpdated:    (eg: IEgresoRow) => void;
}

export default function EgresoItem({
  eg,
  tipos,
  stages,
  metodos,
  canEditStage,
  onDeleted,
  onUpdated,
}: EgresoItemProps) {
  const { user } = useAuth();
  const canModify = user?.id_role !== 5;

  const [editing,     setEditing]     = useState(false);
  const [editForm,    setEditForm]    = useState<EgresoFormValues>({
    id_egreso_tipo:  eg.id_egreso_tipo,
    idMetodoPago:    eg.idMetodoPago,
    iva_bit:         eg.iva_bit ?? 0,
    iva:             eg.iva,
    monto:           Number(eg.monto),
    referencia:      eg.referencia,
    id_egreso_stage: eg.id_egreso_stage,
  });
  const [savingEdit,  setSavingEdit]  = useState(false);
  const [editError,   setEditError]   = useState("");

  const [showDelete,   setShowDelete]   = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState("");

  // local copy of egreso to reflect stage changes from upload
  const [localEg, setLocalEg] = useState<IEgresoRow>(eg);

  const handleEditChange = (field: keyof EgresoFormValues, value: number | string) => {
    setEditForm((f) => ({ ...f, [field]: value }));
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    setEditError("");
    const result = await updateEgreso({ id_egreso: eg.id_egreso, ...editForm });
    if (result.ok) {
      const updated: IEgresoRow = {
        ...localEg,
        ...editForm,
        nombre_tipo:  tipos.find((t) => t.id_egreso_tipo  === editForm.id_egreso_tipo)?.name  ?? localEg.nombre_tipo,
        metodo_pago:  metodos.find((m) => m.idMetodoPago  === editForm.idMetodoPago)?.descripcion ?? localEg.metodo_pago,
        stage:        stages.find((s) => s.id_egreso_stage === editForm.id_egreso_stage)?.name ?? localEg.stage,
      };
      setLocalEg(updated);
      onUpdated(updated);
      setEditing(false);
    } else {
      setEditError(result.message ?? "Error al actualizar");
    }
    setSavingEdit(false);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    setDeleteError("");
    const result = await deleteEgreso(eg.id_egreso);
    if (result.ok) {
      onDeleted(eg.id_egreso);
    } else {
      setDeleteError(result.message ?? "Error al eliminar");
    }
    setDeleting(false);
  };

  const handleStageUpdated = (newStage: number) => {
    const updated: IEgresoRow = {
      ...localEg,
      id_egreso_stage: newStage,
      stage: stages.find((s) => s.id_egreso_stage === newStage)?.name ?? localEg.stage,
    };
    setLocalEg(updated);
    onUpdated(updated);
  };

  return (
    <>
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4">
        {editing ? (
          <EgresoForm
            form={editForm}
            tipos={tipos}
            stages={stages}
            metodos={metodos}
            saving={savingEdit}
            error={editError}
            canEditStage={canEditStage}
            submitLabel="Guardar"
            onChange={handleEditChange}
            onSubmit={handleEdit}
            onCancel={() => { setEditing(false); setEditError(""); }}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Tipo: </span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">{localEg.nombre_tipo}</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Monto: </span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">
                    ${Number(localEg.monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">IVA: </span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">
                    ${Number(localEg.iva).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Método: </span>
                  <span className="text-zinc-700 dark:text-zinc-300">{localEg.metodo_pago}</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Estado: </span>
                  <span className="text-zinc-700 dark:text-zinc-300">{localEg.stage}</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Fecha: </span>
                  <span className="text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{fmtDatetime(localEg.created_at)}</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Capturó: </span>
                  <span className="text-zinc-700 dark:text-zinc-300">{localEg.user}</span>
                </div>
                {localEg.referencia && (
                  <div className="col-span-2">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Ref: </span>
                    <span className="text-zinc-700 dark:text-zinc-300">{localEg.referencia}</span>
                  </div>
                )}
              </div>

              {canModify && (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { setEditing(true); setEditError(""); }}
                    className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => { setShowDelete(true); setDeleteError(""); }}
                    className="rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>

            <EgresoArchivos egreso={localEg} onStageUpdated={handleStageUpdated} />
          </>
        )}
      </div>

      {showDelete && (
        <ConfirmModal
          message="¿Eliminar este egreso? Esta acción no se puede deshacer."
          loading={deleting}
          error={deleteError || null}
          onConfirm={handleDeleteConfirm}
          onCancel={() => { setShowDelete(false); setDeleteError(""); }}
        />
      )}
    </>
  );
}
