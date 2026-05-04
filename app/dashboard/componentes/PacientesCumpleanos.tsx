"use client";

import { useEffect, useState } from "react";
import { getPacientesCumpleanos, IPacienteCumpleanos } from "../actions";
import { useSucursal } from "@/contexts/SucursalContext";
import Link from "next/link";

const fmtBirthday = (val: string) => {
  if (!val) return "—";
  const s = val.includes("T") ? val : val + "T00:00:00";
  return new Date(s).toLocaleDateString("es-MX", { month: "long", day: "2-digit" });
};

const diasParaCumple = (val: string): number => {
  if (!val) return 999;
  const hoy  = new Date();
  hoy.setHours(0, 0, 0, 0);
  const bDay = new Date(val.includes("T") ? val : val + "T00:00:00");
  let next   = new Date(hoy.getFullYear(), bDay.getMonth(), bDay.getDate());
  if (next < hoy) next = new Date(hoy.getFullYear() + 1, bDay.getMonth(), bDay.getDate());
  return Math.round((next.getTime() - hoy.getTime()) / 86_400_000);
};

export default function PacientesCumpleanos() {
  const { selectedId } = useSucursal();
  const [pacientes, setPacientes] = useState<IPacienteCumpleanos[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    getPacientesCumpleanos().then((data) => {
      setPacientes(data);
      setLoading(false);
    });
  }, [selectedId]);

  if (loading) return <p className="text-sm text-zinc-400">Cargando...</p>;

  if (pacientes.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        Ningún paciente cumple años en los próximos 7 días.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs uppercase">
          <tr>
            <th className="px-4 py-2 text-left">Paciente</th>
            <th className="px-4 py-2 text-left">Cumpleaños</th>
            <th className="px-4 py-2 text-left hidden sm:table-cell">Días restantes</th>
            <th className="px-4 py-2 text-left hidden md:table-cell">Teléfono</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
          {pacientes.map((p) => {
            const dias = diasParaCumple(p.fecha_nacimiento);
            return (
              <tr
                key={p.id_paciente}
                className="bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <td className="px-4 py-2">
                  <Link
                    href={`/dashboard/pacientes/${p.id_paciente}/expediente`}
                    className="text-zinc-800 dark:text-zinc-100 hover:underline font-medium"
                  >
                    {p.nombre_paciente}
                  </Link>
                </td>
                <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                  {fmtBirthday(p.fecha_nacimiento)}
                </td>
                <td className="px-4 py-2 hidden sm:table-cell">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      dias === 0
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {dias === 0 ? "¡Hoy!" : `${dias} día${dias === 1 ? "" : "s"}`}
                  </span>
                </td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300 hidden md:table-cell">
                  {p.whatsapp || p.telefono || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
