"use client";

import { IAntecedenteMedico } from "@/interfaces/antecedentes";
import { activeBools, formatDate } from "../useExpedienteMedico";

interface Props {
  antecedente: IAntecedenteMedico;
  onEdit: (a: IAntecedenteMedico) => void;
}

export default function AntecedenteFila({ antecedente: a, onEdit }: Props) {
  const activos = activeBools(a);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">#{a.id_antecedente_medico}</span>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            {formatDate(a.fecha_registro)}
          </span>
          {a.tipo_sangre && (
            <span className="rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
              {a.tipo_sangre}
            </span>
          )}
        </div>
        <button
          onClick={() => onEdit(a)}
          className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
        >
          Editar
        </button>
      </div>

      {activos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activos.map((lbl) => (
            <span
              key={lbl}
              className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-xs text-amber-800 dark:text-amber-300"
            >
              {lbl}
            </span>
          ))}
        </div>
      )}

      {(a.medicamentos_actuales || a.otros) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          {a.medicamentos_actuales && (
            <div>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-0.5">
                Medicamentos actuales
              </span>
              {a.medicamentos_actuales}
            </div>
          )}
          {a.otros && (
            <div>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-0.5">
                Otros
              </span>
              {a.otros}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
