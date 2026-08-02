"use client";

import { IConsulta } from "@/interfaces/consulta";
import { IOnicocriptosisDetalle } from "@/interfaces/onicocriptosis_detalle";
import { IOnicomicosisDetalle } from "@/interfaces/onicomicosis_detalle";
import { IPatologiaUngueal } from "@/interfaces/patologia_ungueal";
import { IValoracionPiel } from "@/interfaces/valoracion_piel";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getPatologiaValoracionByConsulta } from "../actions";
import { formatDate } from "../useExpediente";

interface Props {
  consulta:    IConsulta;
  id_paciente: number;
  onEdit?:     (c: IConsulta) => void;
  onCancel?:   (c: IConsulta) => void;
  hideCostoTotal?: boolean;
  onVerImagenes?: (id_consulta: number) => void;
  showDetalleColumn?: boolean;
  expandAll?: boolean;
}

const PATOLOGIAS: [keyof IPatologiaUngueal, string][] = [
  ["anoniquia",            "Anoniquia"           ],
  ["hematoma_subungueal",  "Hematoma subungueal" ],
  ["microniquia",          "Microniquia"         ],
  ["onicauxis",            "Onicauxis"           ],
  ["onicofosis",           "Onicofosis"          ],
  ["onicolisis",           "Onicolisis"          ],
  ["onicomicosis_grado_1", "Onicomicosis Grado 1"],
  ["onicomicosis_grado_2", "Onicomicosis Grado 2"],
  ["paquioniquia",         "Paquioniquia"        ],
  ["onicocriptosis",       "Onicocriptosis"      ],
];

function formatDedos(detalle: { pie: string; dedo: number }[]): string {
  return detalle
    .map((d) => `${d.pie === "izquierdo" ? "Izq" : "Der"} ${d.dedo}`)
    .join(", ");
}

const CONDITIONS: [keyof IValoracionPiel, string][] = [
  ["anhidrosis",      "Anhidrosis"     ],
  ["bromhidrosis",    "Bromhidrosis"   ],
  ["edema",           "Edema"          ],
  ["helomas",         "Helomas"        ],
  ["hiperdrosis",     "Hiperhidrosis"  ],
  ["hiperqueratosis", "Hiperqueratosis"],
  ["pie_atleta",      "Pie de atleta"  ],
  ["verrugas",        "Verrugas"       ],
];

export default function ConsultaFila({
  consulta: c, id_paciente, onEdit, onCancel, hideCostoTotal = false, onVerImagenes, showDetalleColumn = false, expandAll,
}: Props) {
  const cancelled  = Boolean(c.cancelada);
  const finalizada = Boolean(c.fecha_fin);
  const colSpan    = (hideCostoTotal ? 9 : 10) + (showDetalleColumn ? 1 : 0);

  const [expanded, setExpanded] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [detalle, setDetalle] = useState<{
    patologia:             IPatologiaUngueal | null;
    valoracion:            IValoracionPiel  | null;
    onicomicosisDetalle:   IOnicomicosisDetalle[];
    onicocriptosisDetalle: IOnicocriptosisDetalle[];
  } | null>(null);

  const fetchDetalle = async () => {
    setLoadingDetalle(true);
    try {
      const data = await getPatologiaValoracionByConsulta(c.id_consulta);
      setDetalle(data);
    } finally {
      setLoadingDetalle(false);
    }
  };

  const toggleExpanded = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && detalle === null && !loadingDetalle) {
      await fetchDetalle();
    }
  };

  useEffect(() => {
    if (expandAll === undefined) return;
    setExpanded(expandAll);
    if (expandAll && detalle === null && !loadingDetalle) {
      fetchDetalle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandAll]);

  const patologiasActivas  = detalle?.patologia  ? PATOLOGIAS.filter(([key]) => !!detalle.patologia![key]) : [];
  const condicionesActivas = detalle?.valoracion ? CONDITIONS.filter(([key]) => !!detalle.valoracion![key]) : [];

  return (
    <>
    <tr className={
      cancelled
        ? "bg-rose-50 dark:bg-rose-900/20 opacity-75"
        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
    }>
      <td className="px-4 py-3 text-zinc-500">{c.id_consulta}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
        {formatDate(c.fecha)}
      </td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
        {c.nombre_podologo ?? "—"}
      </td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
        {c.nombre_sucursal ?? "—"}
      </td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
        {c.fecha ? String(c.fecha).slice(11, 16) : "—"}
      </td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
        {c.created_at ? String(c.created_at).slice(11, 16) : "—"}
      </td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
        {c.fecha_fin ? String(c.fecha_fin).slice(11, 16) : "—"}
      </td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
        {c.created_at && c.fecha_fin
          ? (() => {
              const inicio = new Date(String(c.created_at).replace(" ", "T"));
              const fin    = new Date(String(c.fecha_fin).replace(" ", "T"));
              const mins   = Math.round((fin.getTime() - inicio.getTime()) / 60000);
              if (mins < 0) return "—";
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              return h > 0 ? `${h}h ${m}min` : `${m}min`;
            })()
          : "—"}
      </td>
      {!hideCostoTotal && (
        <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
          ${Number(c.costo_total).toFixed(2)}
        </td>
      )}
      {showDetalleColumn && <td className="px-4 py-3"></td>}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleExpanded}
            title={expanded ? "Ocultar detalles" : "Ver detalles"}
            className="flex items-center justify-center rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {onVerImagenes ? (
            <button
              onClick={() => onVerImagenes(c.id_consulta)}
              className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors whitespace-nowrap"
            >
              Ver imágenes
            </button>
          ) : (
            <>
              {!cancelled && !finalizada && onCancel && (
                <button
                  onClick={() => onCancel(c)}
                  className="rounded-md bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900/70 transition-colors"
                >
                  Cancelar
                </button>
              )}
              {cancelled ? (
                <span className="rounded-md bg-rose-100 px-3 py-1 text-xs font-medium text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                  Cancelada
                </span>
              ) : (
                onEdit && (
                  <button
                    onClick={() => onEdit(c)}
                    className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                  >
                    Editar
                  </button>
                )
              )}
              <Link
                href={`/dashboard/pacientes/${id_paciente}/consultas/${c.id_consulta}`}
                className="flex items-center justify-center rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 transition-colors"
                title="Ver consulta"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </>
          )}
        </div>
      </td>
    </tr>
    {expanded && (
      <tr className={cancelled ? "bg-rose-50 dark:bg-rose-900/20" : "bg-zinc-50 dark:bg-zinc-800/30"}>
        <td colSpan={colSpan} className="px-4 py-3">
          {loadingDetalle ? (
            <p className="text-sm text-zinc-400">Cargando detalles...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Patologías</p>
                {!detalle?.patologia ? (
                  <p className="text-sm text-zinc-400">Sin datos registrados</p>
                ) : (
                  <ul className="list-disc list-inside text-sm text-zinc-700 dark:text-zinc-300 space-y-0.5">
                    {patologiasActivas.map(([key, label]) => {
                      const dedos =
                        key === "onicomicosis_grado_1" || key === "onicomicosis_grado_2"
                          ? formatDedos(detalle?.onicomicosisDetalle ?? [])
                          : key === "onicocriptosis"
                          ? formatDedos(detalle?.onicocriptosisDetalle ?? [])
                          : "";
                      return (
                        <li key={key}>
                          {label}
                          {dedos && <span className="text-zinc-500 dark:text-zinc-400"> ({dedos})</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Valoración de piel</p>
                {!detalle?.valoracion ? (
                  <p className="text-sm text-zinc-400">Sin datos registrados</p>
                ) : (
                  <ul className="list-disc list-inside text-sm text-zinc-700 dark:text-zinc-300 space-y-0.5">
                    {condicionesActivas.map(([key, label]) => (
                      <li key={key}>{label}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </td>
      </tr>
    )}
    </>
  );
}

