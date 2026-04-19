"use client";

import { IConsulta } from "@/interfaces/consulta";
import ConsultaFila from "./ConsultaFila";

interface Props {
  id_paciente: number;
  consultas:   IConsulta[];
  loading:     boolean;
  onEdit:      (c: IConsulta) => void;
}

export default function ConsultasTable({ id_paciente, consultas, loading, onEdit }: Props) {
  if (loading) return <p className="text-zinc-500">Cargando...</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
        <thead className="bg-zinc-100 dark:bg-zinc-800">
          <tr>
            {["#", "Fecha", "Podólogo",  "Costo total", ""].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
          {consultas.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                Sin consultas registradas
              </td>
            </tr>
          ) : (
            consultas.map((c) => (
              <ConsultaFila
                key={c.id_consulta}
                consulta={c}
                id_paciente={id_paciente}
                onEdit={onEdit}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
