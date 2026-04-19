"use client";

import { IConsulta } from "@/interfaces/consulta";
import Link from "next/link";
import { formatDate } from "../useExpediente";

interface Props {
  consulta:    IConsulta;
  id_paciente: number;
  onEdit:      (c: IConsulta) => void;
}

export default function ConsultaFila({ consulta: c, id_paciente, onEdit }: Props) {
  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <td className="px-4 py-3 text-zinc-500">{c.id_consulta}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
        {formatDate(c.fecha)}
      </td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
        {c.nombre_podologo ?? "—"}
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
  );
}
