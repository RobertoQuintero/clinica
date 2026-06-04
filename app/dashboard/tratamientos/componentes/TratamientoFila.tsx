"use client";

import { ITratamientoOnicomicosisListRow } from "@/interfaces/tratamiento_onicomicosis";
import { useRouter } from "next/navigation";

interface Props {
  tratamiento: ITratamientoOnicomicosisListRow;
}

const fmtDatetime = (val: string) => {
  if (!val) return "—";
  return new Date(String(val).replace(" ", "T"))
    .toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
};

export default function TratamientoFila({ tratamiento: t }: Props) {
  const router = useRouter();

  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
        {fmtDatetime(t.created_at)}
      </td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{t.nombre_paciente}</td>
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{t.nombre_especialista}</td>
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{t.nombre_usuario}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
          {t.nombre_stage}
          {t.id_stage === 4 && (
            <span className="text-zinc-500 dark:text-zinc-400">
              {t.num_consultas}/{Math.max(6, t.num_consultas)}
            </span>
          )}
        </span>
      </td>
      <td className={`px-4 py-3 text-sm${t.new_message ? " font-medium text-amber-500 dark:text-amber-400" : " text-zinc-600 dark:text-zinc-300"}`}>
        {t.message ?? "—"}
      </td>
      <td className="px-4 py-3 flex justify-end">
        <button
          onClick={() => router.push(`/dashboard/tratamientos/${t.id_tratamiento}`)}
          className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
          title="Ver detalle"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </td>
    </tr>
  );
}
