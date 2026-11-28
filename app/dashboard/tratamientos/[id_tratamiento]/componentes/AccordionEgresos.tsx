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
  stage?:          number;
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

export default function AccordionEgresos({ id_tratamiento, stage }: Props) {
  const { user } = useAuth();
  const canAdd       = user?.id_role === 1 || user?.id_role === 4;
  const canEditStage = user?.id_role === 1 || user?.id_role === 4;
  const [egresos,     setEgresos]     = useState<IEgresoRow[]>([]);
  const [tipos,       setTipos]       = useState<{ id_egreso_tipo: number; name: string }[]>([]);
  const [stages,      setStages]      = useState<{ id_egreso_stage: number; name: string }[]>([]);
  const [metodos,     setMetodos]     = useState<{ idMetodoPago: number; descripcion: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState(false);

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
    }).catch(() => setLoadError(true)).finally(() => setLoadingData(false));
  }, [id_tratamiento]);

  const handleAddChange = (field: keyof EgresoFormValues, value: number | string) => {
    setAddForm((f) => ({ ...f, [field]: value }));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setAddError("");
    try {
    const result = await createEgreso({ id_tratamiento, ...addForm });
    if (result.ok) {
      const rows = await getEgresosByTratamiento(id_tratamiento);
      setEgresos(rows);
      setAdding(false);
      setAddForm({ ...EMPTY_FORM, id_egreso_tipo: tipos[0]?.id_egreso_tipo ?? 0, idMetodoPago: metodos[0]?.idMetodoPago ?? 0, id_egreso_stage: stages[0]?.id_egreso_stage ?? 0 });
    } else {
      setAddError(result.message ?? "Error al guardar");
    }
    } catch {
      setAddError("No se pudo guardar o actualizar la lista de egresos.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-[#c4c6d0] bg-white dark:border-zinc-700 dark:bg-zinc-900 overflow-hidden">
        <h2 className="px-4 py-4 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 sm:px-6">Egresos</h2>

        <div className="px-4 pb-5 sm:px-6 sm:pb-6">
          {loadingData ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando egresos…</p>
          ) : loadError ? (
            <p role="alert" className="text-sm text-red-600">No se pudieron cargar los egresos o ya no tienes acceso.</p>
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
                  disabled={stage!==undefined && stage>=5}
                    onClick={() => setAdding(true)}
                    className="rounded-md bg-[#0051d5] px-4 py-2 text-sm font-medium text-white hover:bg-[#003ea8] dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
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
    </div>
  );
}
