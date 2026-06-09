"use client";

import React from "react";

export interface EgresoFormValues {
  id_egreso_tipo:  number;
  idMetodoPago:    number;
  iva_bit:         number;
  iva:             number;
  monto:           number;
  referencia:      string;
  id_egreso_stage: number;
}

interface Props {
  form:         EgresoFormValues;
  tipos:        { id_egreso_tipo: number; name: string }[];
  stages:       { id_egreso_stage: number; name: string }[];
  metodos:      { idMetodoPago: number; descripcion: string }[];
  saving:       boolean;
  error:        string;
  /** Only roles 1 and 4 may see/edit the estado field */
  canEditStage: boolean;
  title?:       string;
  submitLabel?: string;
  onChange:     (field: keyof EgresoFormValues, value: number | string) => void;
  onSubmit:     (e: React.FormEvent) => void;
  onCancel:     () => void;
}

const selectClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100";
const inputClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 focus:border-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100";

export default function EgresoForm({
  form,
  tipos,
  stages,
  metodos,
  saving,
  error,
  canEditStage,
  title,
  submitLabel = "Guardar",
  onChange,
  onSubmit,
  onCancel,
}: Props) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800 space-y-3"
    >
      {title && (
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {title}
        </h3>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Tipo</label>
          <select
            required
            className={`w-full ${selectClass}`}
            value={form.id_egreso_tipo}
            disabled={true}
            onChange={(e) => onChange("id_egreso_tipo", Number(e.target.value))}
          >
            <option value={0} disabled>Seleccionar…</option>
            {tipos.map((t) => (
              <option key={t.id_egreso_tipo} value={t.id_egreso_tipo}>{t.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Método de pago</label>
          <select
            required
            className={`w-full ${selectClass}`}
            value={form.idMetodoPago}
            onChange={(e) => onChange("idMetodoPago", Number(e.target.value))}
          >
            <option value={0} disabled>Seleccionar…</option>
            {metodos.map((m) => (
              <option key={m.idMetodoPago} value={m.idMetodoPago}>{m.descripcion}</option>
            ))}
          </select>
        </div>

        {canEditStage && (
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Estado</label>
            <select
              required
              className={`w-full ${selectClass}`}
              value={form.id_egreso_stage}
              onChange={(e) => onChange("id_egreso_stage", Number(e.target.value))}
            >
              <option value={0} disabled>Seleccionar…</option>
              {stages.map((s) => (
                <option key={s.id_egreso_stage} value={s.id_egreso_stage}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Monto</label>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={form.monto}
            onChange={(e) => onChange("monto", Number(e.target.value))}
            className={`w-full ${inputClass}`}
          />
        </div>

        <div style={{display:'flex',alignItems:'flex-end',gap:'0.5rem'}}>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">IVA (16%)</label>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={form.iva_bit === 1}
                onChange={(e) => onChange("iva_bit", e.target.checked ? 1 : 0)}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              
            </label>
          </div>
          </div>
          <div style={{flex:1}}>
            <input
              type="number"
              disabled
              value={form.iva_bit === 1 ? (Number(form.monto) * 0.16).toFixed(2) : "0.00"}
              className={`w-full ${inputClass} opacity-60 cursor-not-allowed`}
            />

          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Referencia</label>
          <input
            type="text"
            value={form.referencia}
            onChange={(e) => onChange("referencia", e.target.value)}
            className={`w-full ${inputClass}`}
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
        >
          {saving ? "Guardando…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
