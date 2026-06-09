"use client";

import React, { useEffect, useState } from "react";
import {
  getEgresosByTratamiento,
  getEgresoTipos,
  getEgresoStages,
  getMetodosPagoTratamiento,
  getDefaultTotalTipo1,
  createEgreso,
  IEgresoRow,
} from "@/app/dashboard/tratamientos/actions";
import { useAuth } from "@/contexts/AuthContext";
import EgresoForm, { EgresoFormValues } from "./EgresoForm";
import EgresoItem from "./EgresoItem";

// ─── main accordion ───────────────────────────────────────────────────────────

interface Props {
  id_tratamiento: number;
}

const EMPTY_FORM: EgresoFormValues = {
  id_egreso_tipo:  0,
  idMetodoPago:    0,
  iva_bit:         0,
  iva:             0,
  monto:           0,
  referencia:      "",
  id_egreso_stage: 0,
};

export default function AccordionEgresos({ id_tratamiento }: Props) {
  const { user } = useAuth();
  const canAdd       = user?.id_role === 1 || user?.id_role === 4;
  const canEditStage = user?.id_role === 1 || user?.id_role === 4;

  const [open,        setOpen]        = useState(true);
  const [egresos,     setEgresos]     = useState<IEgresoRow[]>([]);
  const [tipos,       setTipos]       = useState<{ id_egreso_tipo: number; name: string }[]>([]);
  const [stages,      setStages]      = useState<{ id_egreso_stage: number; name: string }[]>([]);
  const [metodos,     setMetodos]     = useState<{ idMetodoPago: number; descripcion: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // add
  const [adding,   setAdding]   = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [addError, setAddError] = useState("");
  const [addForm,  setAddForm]  = useState(EMPTY_FORM);

  useEffect(() => {
    Promise.all([
      getEgresosByTratamiento(id_tratamiento),
      getEgresoTipos(),
      getEgresoStages(),
      getMetodosPagoTratamiento(),
      getDefaultTotalTipo1(),
    ]).then(([rows, t, s, m, defMonto]) => {
      setEgresos(rows);
      setTipos(t);
      setStages(s);
      setMetodos(m);
      setAddForm({ ...EMPTY_FORM, id_egreso_tipo: t[0]?.id_egreso_tipo ?? 0, idMetodoPago: m[0]?.idMetodoPago ?? 0, id_egreso_stage: s[0]?.id_egreso_stage ?? 0, monto: defMonto });
      setLoadingData(false);
    });
  }, [id_tratamiento]);

  const handleAddChange = (field: keyof EgresoFormValues, value: number | string) => {
    setAddForm((f) => ({ ...f, [field]: value }));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setAddError("");
    const result = await createEgreso({ id_tratamiento, ...addForm });
    if (result.ok) {
      const rows = await getEgresosByTratamiento(id_tratamiento);
      setEgresos(rows);
      setAdding(false);
      setAddForm({ ...EMPTY_FORM, id_egreso_tipo: tipos[0]?.id_egreso_tipo ?? 0, idMetodoPago: metodos[0]?.idMetodoPago ?? 0, id_egreso_stage: stages[0]?.id_egreso_stage ?? 0 });
    } else {
      setAddError(result.message ?? "Error al guardar");
    }
    setSaving(false);
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <span className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
          Egresos (Pagos Especialista)
        </span>
        <svg
          className={`h-4 w-4 text-zinc-500 transition-transform dark:text-zinc-400 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="px-6 pb-6">
          {loadingData ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando egresos…</p>
          ) : (
            <>
              {egresos.length === 0 && !adding && (
                <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">Sin egresos registrados.</p>
              )}

              <div className="space-y-4 mb-4">
                {egresos.map((eg) => (
                  <EgresoItem
                    key={eg.id_egreso}
                    eg={eg}
                    tipos={tipos}
                    stages={stages}
                    metodos={metodos}
                    canEditStage={canEditStage}
                    onDeleted={(id) => setEgresos((prev) => prev.filter((r) => r.id_egreso !== id))}
                    onUpdated={(updated) => setEgresos((prev) => prev.map((r) => r.id_egreso === updated.id_egreso ? updated : r))}
                  />
                ))}
              </div>

              {canAdd && (
                !adding ? (
                  <button
                    onClick={() => setAdding(true)}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                  >
                    + Agregar egreso
                  </button>
                ) : (
                  <EgresoForm
                    form={addForm}
                    tipos={tipos}
                    stages={stages}
                    metodos={metodos}
                    saving={saving}
                    error={addError}
                    canEditStage={canEditStage}
                    title="Nuevo egreso"
                    submitLabel="Guardar egreso"
                    onChange={handleAddChange}
                    onSubmit={handleAdd}
                    onCancel={() => { setAdding(false); setAddError(""); }}
                  />
                )
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
