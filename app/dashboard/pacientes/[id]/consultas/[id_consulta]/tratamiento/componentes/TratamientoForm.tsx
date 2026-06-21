"use client";

import { EspecialistaOption, TratamientoFormData } from "../actions";

interface Props {
  form:          TratamientoFormData;
  especialistas: EspecialistaOption[];
  onChange:      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  disabled?:     boolean;
}

export default function TratamientoForm({ form, especialistas, onChange, disabled }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 space-y-5">
      <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
        Datos del tratamiento
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Peso (kg)
          </label>
          <input
            type="number"
            name="peso"
            value={form.peso}
            onChange={onChange}
            disabled={disabled}
            step="0.1"
            min="0"
            placeholder="Ej. 70.5"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Talla
          </label>
          <input
            type="number"
            name="talla"
            value={form.talla}
            onChange={onChange}
            disabled={disabled}
            step="0.1"
            min="0"
            placeholder="Ej. 165"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Altura (cm)
          </label>
          <input
            type="number"
            name="altura"
            value={form.altura}
            onChange={onChange}
            disabled={disabled}
            step="0.1"
            min="0"
            placeholder="Ej. 170"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">
          Antecedentes crónicos
        </label>
        <textarea
          required
          name="antecedentes_cronicos"
          value={form.antecedentes_cronicos}
          onChange={onChange}
          disabled={disabled}
          rows={3}
          placeholder="Diabetes, hipertensión, cáncer, obesidad, cardiovasculares, etc…"
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">
          Antecedentes hepáticos
        </label>
        <textarea
          required
          name="antecedentes_hepaticos"
          value={form.antecedentes_hepaticos}
          onChange={onChange}
          disabled={disabled}
          rows={3}
          placeholder=" hepatitis, cirrosis, ictericia, cáncer de hígado, etc…"
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">
          Alergias
        </label>
        <textarea
          required
          name="alergias"
          value={form.alergias}
          onChange={onChange}
          disabled={disabled}
          rows={3}
          placeholder="Alergias a medicamentos, materiales, alimentos, etc…"
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">
          Medicación actual
        </label>
        <textarea
          required
          name="medicacion_actual"
          value={form.medicacion_actual}
          onChange={onChange}
          disabled={disabled}
          rows={3}
          placeholder="Lista los medicamentos que toma actualmente…"
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">
          Especialista asignado
        </label>
        <select
          required
          name="id_especialista"
          value={form.id_especialista}
          onChange={onChange}
          disabled={disabled}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value={0}>— Selecciona un especialista —</option>
          {especialistas.map((e) => (
            <option key={e.id_user} value={e.id_user}>
              {e.nombre}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
