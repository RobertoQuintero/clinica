"use client";

import { IConsulta } from "@/interfaces/consulta";
import Link from "next/link";
import { formatDate } from "../useExpediente";

interface Props {
  id_paciente: number;
  consultas:   IConsulta[];
  loading:     boolean;
  onEdit:      (c: IConsulta) => void;
}

export default function ConsultasTable({ id_paciente, consultas, loading, onEdit }: Props) {
  if (loading) return <p className="text-zinc-500">Cargando...</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
        <thead className="bg-zinc-100 dark:bg-zinc-800">
          <tr>
            {["#", "Fecha", "Diagnóstico", "Tratamiento aplicado", "Observaciones", "Costo total", ""].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
          {consultas.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                Sin consultas registradas
              </td>
            </tr>
          ) : (
            consultas.map((c) => (
              <tr key={c.id_consulta} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-3 text-zinc-500">{c.id_consulta}</td>
                <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
                  {formatDate(c.fecha)}
                </td>
                <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 max-w-xs truncate">
                  {c.diagnostico || "—"}
                </td>
                <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 max-w-xs truncate">
                  {c.tratamiento_aplicado || "—"}
                </td>
                <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 max-w-xs truncate">
                  {c.observaciones || "—"}
                </td>
                <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
                  ${Number(c.costo_total).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(c)}
                      className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                    >
                      Editar
                    </button>
                    <Link
                      href={`/dashboard/pacientes/${id_paciente}/consultas/${c.id_consulta}`}
                      className="flex items-center justify-center rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 transition-colors"
                      title="Ver consulta"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
