"use client";

import { IAntecedenteMedico } from "@/interfaces/antecedentes";

interface Props {
  form: IAntecedenteMedico;
  saving: boolean;
  error: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onCheck: (name: keyof IAntecedenteMedico) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

const BOOLEAN_FIELDS: { name: keyof IAntecedenteMedico; label: string }[] = [
  { name: "alergia_anestesia",           label: "Alergia a anestesia" },
  { name: "alergia_antibioticos",        label: "Alergia a antibióticos" },
  { name: "alergia_sulfas",              label: "Alergia a sulfas" },
  { name: "alergia_latex",               label: "Alergia a látex" },
  { name: "alergia_ninguna",             label: "Sin alergias" },
  { name: "diabetico",                   label: "Diabético/a" },
  { name: "hipertenso",                  label: "Hipertenso/a" },
  { name: "hipotiroidismo",              label: "Hipotiroidismo" },
  { name: "cancer",                      label: "Cáncer" },
  { name: "embarazada",                  label: "Embarazada" },
  { name: "lactando",                    label: "Lactando" },
  { name: "fracturas",                   label: "Fracturas" },
  { name: "antecedentes_dermatologicos", label: "Antecedentes dermatológicos" },
];

const TIPO_SANGRE_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function AntecedenteMedicoModal({ form, saving, error, onChange, onCheck, onSubmit, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-50">
            {form.id_antecedente_medico === 0 ? "Nuevo expediente médico" : "Editar expediente médico"}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 flex flex-col gap-5">
          {error && (
            <p className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Fecha de registro</span>
              <input
                type="date"
                name="fecha_registro"
                value={form.fecha_registro as string}
                onChange={onChange}
                required
                className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tipo de sangre</span>
              <select
                name="tipo_sangre"
                value={form.tipo_sangre}
                onChange={onChange}
                className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <option value="">— Seleccionar —</option>
                {TIPO_SANGRE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
            <legend className="px-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Condiciones médicas</legend>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-1">
              {BOOLEAN_FIELDS.map(({ name, label }) => (
                <label key={name} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!form[name]}
                    onChange={() => onCheck(name)}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-800 focus:ring-zinc-400"
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Medicamentos actuales</span>
            <textarea
              name="medicamentos_actuales"
              value={form.medicamentos_actuales}
              onChange={onChange}
              rows={2}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Otros antecedentes</span>
            <textarea
              name="otros"
              value={form.otros}
              onChange={onChange}
              rows={2}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-none"
            />
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
