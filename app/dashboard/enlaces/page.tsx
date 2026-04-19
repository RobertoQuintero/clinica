"use client";

import { IPatologiaUrl } from "@/interfaces/patologia_url";
import { useEffect, useState } from "react";
import { getEnlaces } from "./actions";
import EnlaceFila from "./componentes/EnlaceFila";

export default function EnlacesPage() {
  const [enlaces, setEnlaces]   = useState<IPatologiaUrl[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");

  type SortKey = "nombre";
  const [sortKey, setSortKey]   = useState<SortKey | null>(null);
  const [sortAsc, setSortAsc]   = useState(true);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((prev) => !prev);
    else { setSortKey(key); setSortAsc(true); }
  };

  const fetchEnlaces = async () => {
    setLoading(true);
    try {
      const data = await getEnlaces();
      setEnlaces(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEnlaces(); }, []);

  const enlacesFiltrados = enlaces
    .filter((e) => e.nombre_patologia.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (!sortKey) return 0;
      const va = a.nombre_patologia.toLowerCase();
      const vb = b.nombre_patologia.toLowerCase();
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-50">Enlaces</h2>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
      </div>

      {loading ? (
        <p className="text-zinc-500">Cargando…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                <th
                  onClick={() => toggleSort("nombre")}
                  className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Nombre
                  <span className="ml-1 text-xs">
                    {sortKey === "nombre" ? (sortAsc ? "▲" : "▼") : <span className="opacity-30">▲</span>}
                  </span>
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300">URL</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
              {enlacesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                    Sin registros
                  </td>
                </tr>
              ) : (
                enlacesFiltrados.map((e) => (
                  <EnlaceFila
                    key={e.id_patologia_url}
                    enlace={e}
                    onSaved={fetchEnlaces}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
