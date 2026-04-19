import { IPatologiaUngueal } from "@/interfaces/patologia_ungueal";
import React from "react";

interface Props {
  form:     IPatologiaUngueal;
  onChange: React.Dispatch<React.SetStateAction<IPatologiaUngueal>>;
  saving:   boolean;
  error:    string | null;
  onSubmit: (e: React.FormEvent) => void;
  locked?:  boolean;
}

const PATOLOGIAS: [keyof IPatologiaUngueal, string][] = [
  ["anoniquia",           "Anoniquia"          ],
  ["microniquia",         "Microniquia"        ],
  ["onicolisis",          "Onicolisis"         ],
  ["onicauxis",           "Onicauxis"          ],
  ["hematoma_subungueal", "Hematoma subungueal"],
  ["onicofosis",          "Onicofosis"         ],
  ["paquioniquia",        "Paquioniquia"       ],
  ["onicomicosis",        "Onicomicosis"       ],
];

export default function TabPatologia({ form, onChange, saving, error, onSubmit, locked }: Props) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </p>
      )}

      <div>
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-3">Patologías</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PATOLOGIAS.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!form[key]}
                onChange={(e) => onChange((f) => ({ ...f, [key]: e.target.checked }))}
                disabled={locked}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-800 focus:ring-zinc-500 disabled:cursor-not-allowed"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {!locked && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors dark:bg-zinc-600 dark:hover:bg-zinc-500"
          >
            {saving
              ? "Guardando..."
              : form.id_patologia === 0
                ? "Registrar patología"
                : "Guardar cambios"}
          </button>
        </div>
      )}
    </form>
  );
}
