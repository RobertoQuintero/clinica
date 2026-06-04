"use client";

import { ITratamientoOnicomicosisListRow } from "@/interfaces/tratamiento_onicomicosis";
import { useEffect, useState } from "react";
import { useSucursal } from "@/contexts/SucursalContext";
import { useAuth } from "@/contexts/AuthContext";
import { getTratamientos, searchTratamientos } from "./actions";
import TratamientoFila from "./componentes/TratamientoFila";

export default function TratamientosPage() {
  const { selectedId } = useSucursal();
  const { user } = useAuth();

  const [tratamientos, setTratamientos] = useState<ITratamientoOnicomicosisListRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [searched, setSearched]         = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const id_especialista = user?.id_role === 5 ? user.id_user : undefined;
      const data = await getTratamientos(selectedId, id_especialista);
      setTratamientos(data);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchEnter = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || search.length < 3) return;
    setLoading(true);
    setSearched(true);
    try {
      const id_especialista = user?.id_role === 5 ? user.id_user : undefined;
      const data = await searchTratamientos(selectedId, search.trim(), id_especialista);
      setTratamientos(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); setSearched(false); }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = tratamientos.filter((t) => {
    const q = search.toLowerCase();
    return (
      t.nombre_paciente.toLowerCase().includes(q) ||
      t.nombre_especialista.toLowerCase().includes(q) ||
      t.nombre_usuario.toLowerCase().includes(q) ||
      t.nombre_stage.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
          Tratamientos Onicomicosis
        </h1>
        <input
          type="search"
          placeholder="Buscar paciente, especialista… (Enter para buscar en BD)"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (e.target.value === "" && searched) { fetchData(); setSearched(false); }
          }}
          onKeyDown={handleSearchEnter}
          className="w-full sm:w-72 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 placeholder-zinc-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:placeholder-zinc-500"
        />
      </div>

      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">
          {search ? "Sin resultados." : "No hay tratamientos registrados para esta sucursal."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 ">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Paciente
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Especialista
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Solicitó
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Mensaje
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-700/50 dark:bg-zinc-900">
              {filtered.map((t) => (
                <TratamientoFila key={t.id_tratamiento} tratamiento={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
