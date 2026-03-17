"use client";

import { ICita } from "@/interfaces/cita";
import { IPaciente } from "@/interfaces/paciente";
import { IUser } from "@/interfaces/user";
import { useEffect, useRef, useState } from "react";

const ESTADOS = ["agendada", "confirmada", "atendida", "cancelada"] as const;

interface Props {
  cita: ICita;
  pacientes: IPaciente[];
  podologos: IUser[];
  onEdit: (c: ICita) => void;
  onChangeEstado: (id_cita: number, estado: string) => void;
}

const estadoBadge = (estado: string, fecha_inicio: string | Date) => {
  if (estado === "agendada") {
    const inicio = new Date(String(fecha_inicio).replace(" ", "T"));
    if (!isNaN(inicio.getTime()) && inicio < new Date()) {
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    }
  }
  const map: Record<string, string> = {
    pendiente:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    confirmada: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    atendida:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    cancelada:  "bg-red-50 text-red-400 dark:bg-red-950/40 dark:text-red-400",
  };
  return map[estado] ?? "bg-zinc-100 text-zinc-500";
};

const fmtDate = (d: Date | string) => {
  if (!d) return "—";
  // Replace space separator with T so the string is parsed as local time (no UTC shift)
  const normalized = String(d).replace(" ", "T");
  return new Date(normalized).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
};

export default function CitaFila({ cita: c, pacientes, podologos, onEdit, onChangeEstado }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

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
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{pacienteName(c.id_paciente)}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{podologoName(c.id_podologo)}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">{fmtDate(c.fecha_inicio)}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">{fmtDate(c.fecha_fin)}</td>
      <td className="px-4 py-3">
        <div ref={ref} className="relative inline-block">
          <span
            onClick={() => setOpen((v) => !v)}
            className={`inline-block cursor-pointer select-none rounded-full px-2 py-0.5 text-xs font-medium capitalize ${estadoBadge(c.estado.toLowerCase(), c.fecha_inicio)}`}
          >
            {c.estado}
          </span>
          {open && (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[130px] rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
              {ESTADOS.map((est) => (
                <button
                  key={est}
                  onClick={() => { onChangeEstado(c.id_cita, est); setOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-xs capitalize hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                    c.estado.toLowerCase() === est ? "font-semibold text-zinc-900 dark:text-zinc-50" : "text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  {est}
                </button>
              ))}
            </div>
          )}
        </div>
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
