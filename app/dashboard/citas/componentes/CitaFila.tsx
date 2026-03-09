"use client";

import { ICita } from "@/interfaces/cita";
import { IPaciente } from "@/interfaces/paciente";
import { IUser } from "@/interfaces/user";

interface Props {
  cita: ICita;
  pacientes: IPaciente[];
  podologos: IUser[];
  onEdit: (c: ICita) => void;
}

const estadoBadge = (estado: string) => {
  const map: Record<string, string> = {
    pendiente:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    confirmada: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    completada: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    cancelada:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return map[estado] ?? "bg-zinc-100 text-zinc-500";
};

const fmtDate = (d: Date | string) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
};

export default function CitaFila({ cita: c, pacientes, podologos, onEdit }: Props) {
  const pacienteName = (id: number) => {
    const p = pacientes.find((x) => x.id_paciente === id);
    return p ? `${p.nombre} ${p.apellido_paterno}` : id;
  };

  const podologoName = (id: number) => {
    const u = podologos.find((x) => x.id_user === id);
    return u ? u.nombre : id;
  };

  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <td className="px-4 py-3 text-zinc-500">{c.id_cita}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{pacienteName(c.id_paciente)}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{podologoName(c.id_podologo)}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">{fmtDate(c.fecha_inicio)}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">{fmtDate(c.fecha_fin)}</td>
      <td className="px-4 py-3">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${estadoBadge(c.estado)}`}>
          {c.estado}
        </span>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onEdit(c)}
          className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
        >
          Editar
        </button>
      </td>
    </tr>
  );
}
