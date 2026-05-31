"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addZeroToday } from "@/utils/date_helpper";
import { getConsultasPorRango, IConsultaRango } from "../actions";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtTime(val: string | null): string {
  if (!val) return "—";
  return String(val).replace(" ", "T").slice(11, 16);
}

function fmtDateLabel(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  return d.toLocaleDateString("es-MX", {
    weekday: "long",
    year:    "numeric",
    month:   "long",
    day:     "numeric",
  });
}

function groupByDate(consultas: IConsultaRango[]): Map<string, IConsultaRango[]> {
  const map = new Map<string, IConsultaRango[]>();
  for (const c of consultas) {
    const key = String(c.fecha).slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return map;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function ConsultasRango() {
  const router  = useRouter();
  const today   = addZeroToday(new Date());

  const [fechaInicio, setFechaInicio] = useState(today);
  const [fechaFin,    setFechaFin   ] = useState(today);
  const [consultas,   setConsultas  ] = useState<IConsultaRango[]>([]);
  const [loading,     setLoading    ] = useState(false);
  const [searched,    setSearched   ] = useState(false);
  const [openDates,   setOpenDates  ] = useState<Set<string>>(new Set());

  const handleBuscar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSearched(false);
    const data = await getConsultasPorRango(fechaInicio, fechaFin);
    setConsultas(data);
    setSearched(true);
    setOpenDates(new Set());
    setLoading(false);
  };

  const toggleDate = (key: string) => {
    setOpenDates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const grouped = groupByDate(consultas);

  return (
    <div className="space-y-4">

      {/* search form */}
      <form onSubmit={handleBuscar} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">Desde</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => {
              const val = e.target.value;
              setFechaInicio(val);
              if (val > fechaFin) setFechaFin(val);
            }}
            required
            className="border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">Hasta</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => {
              const val = e.target.value;
              setFechaFin(val);
              if (val < fechaInicio) setFechaInicio(val);
            }}
            required
            className="border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-1.5 text-sm font-medium bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {/* empty state */}
      {searched && consultas.length === 0 && (
        <p className="text-sm text-zinc-400">
          No se encontraron consultas en ese rango de fechas.
        </p>
      )}

      {/* results grouped by date */}
      {consultas.length > 0 && (
        <div className="space-y-2">
          {[...grouped.entries()].map(([dateKey, items]) => (
            <div
              key={dateKey}
              className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden"
            >
              {/* accordion header */}
              <button
                type="button"
                onClick={() => toggleDate(dateKey)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-left hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 capitalize">
                  {fmtDateLabel(dateKey)}
                </span>
                <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {items.length} consulta{items.length !== 1 ? "s" : ""}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 transition-transform ${openDates.has(dateKey) ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>

              {/* accordion body */}
              {openDates.has(dateKey) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 text-xs uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Inicio</th>
                        <th className="px-3 py-2 text-left">Fin</th>
                        <th className="px-3 py-2 text-left">Paciente</th>
                        <th className="px-3 py-2 text-left hidden sm:table-cell">Podólogo</th>
                        <th className="px-3 py-2 text-left">Estado</th>
                        <th className="px-3 py-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
                      {items.map((c) => (
                        <tr
                          key={c.id_consulta}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        >
                          <td className="px-3 py-2 tabular-nums text-zinc-700 dark:text-zinc-300">
                            {fmtTime(c.fecha)}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-zinc-700 dark:text-zinc-300">
                            {fmtTime(c.fecha_fin)}
                          </td>
                          <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                            {c.nombre_paciente}
                          </td>
                          <td className="px-3 py-2 hidden sm:table-cell text-zinc-600 dark:text-zinc-300">
                            {c.nombre_podologo}
                          </td>
                          <td className="px-3 py-2">
                            {c.cancelada ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                Cancelada
                              </span>
                            ) : c.fecha_fin ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                Finalizada
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                En curso
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/dashboard/pacientes/${c.id_paciente}/consultas/${c.id_consulta}`
                                )
                              }
                              className="text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2 transition-colors"
                            >
                              Ver detalle
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
