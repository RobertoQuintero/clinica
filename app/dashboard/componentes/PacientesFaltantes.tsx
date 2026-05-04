"use client";

import { useEffect, useState } from "react";
import { getPacientesFaltantes, IPacienteFaltante } from "../actions";
import { useSucursal } from "@/contexts/SucursalContext";
import Link from "next/link";

const fmtDate = (val: string | null) => {
  if (!val) return "Sin consultas";
  const s = val.replace(" ", "T");
  return new Date(s)
    .toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "2-digit" });
};

export default function PacientesFaltantes() {
  const { selectedId } = useSucursal();
  const [pacientes, setPacientes] = useState<IPacienteFaltante[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    getPacientesFaltantes().then((data) => {
      setPacientes(data);
      setLoading(false);
    });
  }, [selectedId]);

  if (loading) return <p className="text-sm text-zinc-400">Cargando...</p>;

  if (pacientes.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        No hay pacientes faltantes.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs uppercase">
          <tr>
            <th className="px-4 py-2 text-left">Paciente</th>
            <th className="px-4 py-2 text-left hidden sm:table-cell">Última consulta</th>
            <th className="px-4 py-2 text-left hidden md:table-cell">Teléfono</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
          {pacientes.map((p) => (
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
              <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400 hidden sm:table-cell">
                {fmtDate(p.ultima_consulta)}
              </td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300 hidden md:table-cell">
                {p.whatsapp || p.telefono || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
