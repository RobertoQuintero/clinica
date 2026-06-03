"use client";

import { IConsulta } from "@/interfaces/consulta";
import Link from "next/link";
import { formatDate } from "../useExpediente";

interface Props {
  consulta:    IConsulta;
  id_paciente: number;
  onEdit?:     (c: IConsulta) => void;
  onCancel?:   (c: IConsulta) => void;
  hideCostoTotal?: boolean;
  onVerImagenes?: (id_consulta: number) => void;
}

export default function ConsultaFila({ consulta: c, id_paciente, onEdit, onCancel, hideCostoTotal = false, onVerImagenes }: Props) {
  const cancelled  = Boolean(c.cancelada);
  const finalizada = Boolean(c.fecha_fin);

  return (
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
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {onVerImagenes ? (
            <button
              onClick={() => onVerImagenes(c.id_consulta)}
              className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors whitespace-nowrap"
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
  );
}

