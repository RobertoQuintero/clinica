import { IValoracionPiel } from "@/interfaces/valoracion_piel";
import React from "react";

interface Props {
  form:     IValoracionPiel;
  onChange: React.Dispatch<React.SetStateAction<IValoracionPiel>>;
  saving:   boolean;
  error:    string | null;
  onSubmit: (e: React.FormEvent) => void;
  locked?:  boolean;
}

const CONDITIONS: [keyof IValoracionPiel, string][] = [
  ["anhidrosis",      "Anhidrosis"     ],
  ["bromhidrosis",    "Bromhidrosis"   ],
  ["dermatomicosis",  "Dermatomicosis" ],
  ["edema",           "Edema"          ],
  ["helomas",         "Helomas"        ],
  ["hiperdrosis",     "Hiperhidrosis"  ],
  ["hiperqueratosis", "Hiperqueratosis"],
  ["pie_atleta",      "Pie de atleta"  ],
  ["verrugas",        "Verrugas"       ],
];

export default function TabValoracion({ form, onChange, saving, error, onSubmit, locked }: Props) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </p>
      )}

      {/* fecha */}
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
          Fecha de valoración
        </label>
        <input
          type="date"
          value={String(form.fecha_valoracion ?? "").slice(0, 10)}
          onChange={(e) => onChange((f) => ({ ...f, fecha_valoracion: e.target.value }))}
          required
          disabled={locked}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      {/* condiciones */}
      <div>
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-3">Condiciones</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CONDITIONS.map(([key, label]) => (
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

      {/* observaciones */}
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
          Observaciones
        </label>
        <textarea
          value={form.observaciones}
          onChange={(e) => onChange((f) => ({ ...f, observaciones: e.target.value }))}
          rows={3}
          placeholder="Observaciones adicionales..."
          disabled={locked}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none disabled:opacity-60 disabled:cursor-not-allowed"
        />
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
              : form.id_valoracion_piel === 0
                ? "Registrar valoración"
                : "Guardar cambios"}
          </button>
        </div>
      )}
    </form>
  );
}
