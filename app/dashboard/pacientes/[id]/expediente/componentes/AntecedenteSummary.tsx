"use client";

import { IAntecedenteMedico } from "@/interfaces/antecedentes";
import { formatDate } from "../useExpediente";

const BOOL_LABELS: [keyof IAntecedenteMedico, string][] = [
  ["alergia_anestesia",           "Alergia anestesia"],
  ["alergia_antibioticos",        "Alergia antibióticos"],
  ["alergia_sulfas",              "Alergia sulfas"],
  ["alergia_latex",               "Alergia látex"],
  ["alergia_ninguna",             "Sin alergias"],
  ["diabetico",                   "Diabético/a"],
  ["hipertenso",                  "Hipertenso/a"],
  ["hipotiroidismo",              "Hipotiroidismo"],
  ["cancer",                      "Cáncer"],
  ["embarazada",                  "Embarazada"],
  ["lactando",                    "Lactando"],
  ["fracturas",                   "Fracturas"],
  ["antecedentes_dermatologicos", "Antec. dermatológicos"],
];

interface Props {
  antecedente: IAntecedenteMedico;
}

export default function AntecedenteSummary({ antecedente }: Props) {
  return (
    <div className="mb-6 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Expediente médico — registro más reciente
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {formatDate(antecedente.fecha_registro)}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        {BOOL_LABELS.map(([key, label]) =>
          antecedente[key] ? (
            <span
              key={key}
              className="inline-block rounded-full bg-zinc-200 dark:bg-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-200"
            >
              {label}
            </span>
          ) : null
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
        <div>
          <span className="font-medium text-zinc-600 dark:text-zinc-400">Tipo de sangre: </span>
          <span className="text-zinc-800 dark:text-zinc-100">{antecedente.tipo_sangre || "—"}</span>
        </div>
        <div>
          <span className="font-medium text-zinc-600 dark:text-zinc-400">Medicamentos actuales: </span>
          <span className="text-zinc-800 dark:text-zinc-100">{antecedente.medicamentos_actuales || "—"}</span>
        </div>
        <div>
          <span className="font-medium text-zinc-600 dark:text-zinc-400">Otros: </span>
          <span className="text-zinc-800 dark:text-zinc-100">{antecedente.otros || "—"}</span>
        </div>
      </div>
    </div>
  );
}
