"use client";

import { useAuth } from "@/contexts/AuthContext";
import { IPaciente } from "@/interfaces/paciente";
import { useRouter } from "next/navigation";

interface Props {
  paciente: IPaciente;
  onEdit: (p: IPaciente) => void;
  showWhatsapp?: boolean;
}

export default function PacienteFila({ paciente: p, onEdit, showWhatsapp = false }: Props) {
  const router = useRouter();
  const {user}= useAuth()
    const date=new Date(p.created_at)
    date.setHours(date.getHours()+12)

  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.nombre}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.apellido_paterno}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.apellido_materno}</td>
      {showWhatsapp && <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.whatsapp}</td>}
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.sexo}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.nombre_sucursal ?? "—"}</td>
      <td className="px-4 py-3">
        {p.en_tratamiento_onicomicosis  && (
          <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {p.en_tratamiento_onicomicosis}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {p.onicomicosis_ultima_consulta && (
            <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
              Onicomicosis
            </span>
          )}
          {p.onicocriptosis_ultima_consulta && (
            <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              Onicocriptosis
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 flex gap-2">
        {
          ((new Date()< date)||!p.id_paciente ||( user?.id_role===1||user?.id_role===4))&&<button
          onClick={() => onEdit(p)}
          className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
        >
          Editar
        </button>}
        <button
          onClick={() => router.push(`/dashboard/pacientes/${p.id_paciente}/expediente`)}
          className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Expediente 
        </button>
      </td>
    </tr>
  );
}
