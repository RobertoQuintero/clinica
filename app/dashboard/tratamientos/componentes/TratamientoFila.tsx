"use client";

import { ITratamientoOnicomicosisListRow } from "@/interfaces/tratamiento_onicomicosis";
import { useRouter } from "next/navigation";

interface Props {
  tratamiento: ITratamientoOnicomicosisListRow;
}

const fmtDatetime = (val: string) => {
  if (!val) return "—";
  const s = String(val).replace(" ", "T");
  return new Date(s.includes("T") ? s : s + "T00:00:00")
    .toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "2-digit" });
};

export default function TratamientoFila({ tratamiento: t }: Props) {
  const router = useRouter();

  return (
    <tr className="transition-colors hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50">
      <td className="whitespace-nowrap px-4 py-3 text-[#0b1c30] dark:text-zinc-100">
        {fmtDatetime(t.created_at)}
      </td>
      <td className="px-4 py-3 font-semibold text-[#0b1c30] dark:text-zinc-100">{t.nombre_paciente}</td>
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{t.nombre_especialista}</td>
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{t.whatsapp_paciente ?? "—"}</td>
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{t.pago_especialista}</td>
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{t.nombre_usuario}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dbe1ff] px-2.5 py-1 text-xs font-semibold text-[#003ea8] dark:bg-blue-900/40 dark:text-blue-200">
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
          aria-label={`Ver detalle del tratamiento de ${t.nombre_paciente}`}
          className="rounded-lg bg-[#eff4ff] px-3 py-2 text-xs font-semibold text-[#0051d5] transition-colors hover:bg-[#dbe1ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0051d5] dark:bg-zinc-800 dark:text-blue-300 dark:hover:bg-zinc-700 dark:focus-visible:ring-blue-400"
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
