"use client";

import { IPaciente } from "@/interfaces/paciente";
import { useRouter } from "next/navigation";

interface Props {
  paciente: IPaciente;
  onEdit: (p: IPaciente) => void;
}

export default function PacienteFila({ paciente: p, onEdit }: Props) {
  const router = useRouter();

  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.nombre}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.apellido_paterno}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.apellido_materno}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.telefono}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.sexo}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.ciudad_preferida}</td>
      <td className="px-4 py-3 flex gap-2">
        <button
          onClick={() => onEdit(p)}
          className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
        >
          Editar
        </button>
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
