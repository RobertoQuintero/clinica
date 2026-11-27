"use client";

import { ITratamientoOnicomicosisListRow } from "@/interfaces/tratamiento_onicomicosis";
import { useState } from "react";
import { useSucursal } from "@/contexts/SucursalContext";
import { useAuth } from "@/contexts/AuthContext";
import { getTratamientos, searchTratamientos } from "./actions";
import { useAsyncData } from "@/hooks/useAsyncData";
import TratamientoFila from "./componentes/TratamientoFila";
import { SucursalName } from "../componentes/SucursalName";
import { Search } from "lucide-react";

export default function TratamientosPage() {
  const { selectedId } = useSucursal();
  const { user } = useAuth();

  const [search, setSearch]             = useState("");
  const [searched, setSearched]         = useState(false);
  const [searchResults, setSearchResults] = useState<ITratamientoOnicomicosisListRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);

  // El rol 5 (médico externo) solo ve sus propios tratamientos.
  const especialistaId = user?.id_role === 5 ? user.id_user : null;
  const tratamientosData = useAsyncData([selectedId, especialistaId], () =>
    getTratamientos(selectedId, especialistaId ?? undefined),
  );
  const { reload: reloadTratamientos } = tratamientosData;

  // Al cambiar de sucursal se descarta la búsqueda en BD y se vuelve al listado de la sucursal.
  const [previousSelectedId, setPreviousSelectedId] = useState(selectedId);
  if (selectedId !== previousSelectedId) {
    setPreviousSelectedId(selectedId);
    setSearched(false);
  }

  const tratamientos: ITratamientoOnicomicosisListRow[] = searched
    ? searchResults
    : (tratamientosData.data ?? []);
  const loading = searched ? searchLoading : tratamientosData.loading;
  const hasError = searched ? searchError : Boolean(tratamientosData.error);

  const handleSearchEnter = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || search.length < 3) return;
    setSearchLoading(true);
    setSearchError(false);
    setSearched(true);
    try {
      const data = await searchTratamientos(selectedId, search.trim(), especialistaId ?? undefined);
      setSearchResults(data);
    } catch {
      setSearchError(true);
    } finally {
      setSearchLoading(false);
    }
  };

  const filtered = tratamientos.filter((t) => {
    const q = search.toLowerCase();
    return (
      t.nombre_paciente.toLowerCase().includes(q) ||
      t.nombre_especialista.toLowerCase().includes(q) ||
      t.nombre_usuario.toLowerCase().includes(q) ||
      t.nombre_stage.toLowerCase().includes(q) ||
      (t.whatsapp_paciente ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 sm:p-6">
      <SucursalName/>
      <div className="mb-6">
        <h1 className="text-[28px] font-bold leading-9 tracking-[-0.02em] text-[#0b1c30] dark:text-zinc-50">
          Tratamientos Onicomicosis
        </h1>
      </div>
      <div className="mb-5 rounded-xl border border-[#c4c6d0] bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="relative w-full sm:max-w-lg">
        <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#44474f] dark:text-zinc-400" />
        <input
          type="search"
          aria-label="Buscar tratamientos"
          placeholder="Buscar paciente, especialista… (Enter para buscar en BD)"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (e.target.value === "" && searched) { reloadTratamientos(); setSearched(false); }
          }}
          onKeyDown={handleSearchEnter}
          className="w-full rounded-lg border border-[#c4c6d0] bg-[#eff4ff] py-2 pl-10 pr-4 text-sm text-[#0b1c30] placeholder:text-[#747780] focus:outline-none focus:ring-2 focus:ring-[#0051d5] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:ring-blue-400"
        />
        </div>
      </div>

      {loading ? (
        <p role="status" className="rounded-xl border border-[#c4c6d0] bg-white p-6 text-sm text-[#44474f] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">Cargando…</p>
      ) : hasError ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">No se pudieron cargar los tratamientos. Intenta nuevamente.</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-[#c4c6d0] bg-white p-6 text-sm text-[#44474f] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          {search ? "Sin resultados." : "No hay tratamientos registrados para esta sucursal."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#c4c6d0] bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <table className="min-w-full divide-y divide-[#d3e4fe] text-sm dark:divide-zinc-700">
            <thead className="bg-[#eff4ff] dark:bg-zinc-800">
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
                  WhatsApp
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Pago Especialista
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
            <tbody className="divide-y divide-[#e5eeff] bg-white dark:divide-zinc-700/50 dark:bg-zinc-900">
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
