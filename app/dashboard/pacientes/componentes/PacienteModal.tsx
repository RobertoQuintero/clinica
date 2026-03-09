"use client";

import { IPaciente } from "@/interfaces/paciente";

interface Props {
  form: IPaciente;
  saving: boolean;
  error: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function PacienteModal({ form, saving, error, onChange, onSubmit, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-50">
            {form.id_paciente === 0 ? "Nuevo paciente" : "Editar paciente"}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={onSubmit} className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {error && (
            <p className="col-span-2 rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {(
            [
              { name: "nombre",                       label: "Nombre",                       type: "text" },
              { name: "apellido_paterno",             label: "Apellido paterno",             type: "text" },
              { name: "apellido_materno",             label: "Apellido materno",             type: "text" },
              { name: "telefono",                     label: "Teléfono",                     type: "text" },
              { name: "whatsapp",                     label: "WhatsApp",                     type: "text" },
              { name: "fecha_nacimiento",             label: "Fecha de nacimiento",          type: "date" },
              { name: "direccion",                    label: "Dirección",                    type: "text" },
              { name: "ciudad_preferida",             label: "Ciudad preferida",             type: "text" },
              { name: "contacto_emergencia_nombre",   label: "Contacto emergencia nombre",   type: "text" },
              { name: "contacto_emergencia_whatsapp", label: "Contacto emergencia WhatsApp", type: "text" },
            ] as { name: keyof IPaciente; label: string; type: string }[]
          ).map(({ name, label, type }) => (
            <label key={name} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
              <input
                type={type}
                name={name}
                value={form[name] as string ?? ""}
                onChange={onChange}
                className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </label>
          ))}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Sexo</span>
            <select
              name="sexo"
              value={form.sexo}
              onChange={onChange}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="">Seleccionar</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </label>
          <label className="col-span-1 sm:col-span-2 flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Observaciones generales</span>
            <textarea
              name="observaciones_generales"
              value={form.observaciones_generales ?? ""}
              onChange={onChange}
              rows={3}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-none"
            />
          </label>
          <div className="col-span-1 sm:col-span-2 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
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
