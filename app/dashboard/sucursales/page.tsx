"use client";

import { ICatState, ISucursal } from "@/interfaces/sucursal";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getStates, getSucursales, saveSucursal } from "./actions";
import SucursalFila from "./componentes/SucursalFila";
import SucursalModal from "./componentes/SucursalModal";

type FormData = Pick<ISucursal, "id_sucursal" | "nombre" | "ciudad" | "direccion" | "telefono" | "id_state">;

const EMPTY: FormData = { id_sucursal: 0, nombre: "", ciudad: null, direccion: null, telefono: null, id_state: null };

export default function SucursalesPage() {
  const { user }                    = useAuth();
  const router                      = useRouter();
  const [sucursales, setSucursales] = useState<ISucursal[]>([]);
  const [states, setStates]         = useState<ICatState[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState<FormData>(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState("");

  type SortKey = "nombre" |"estado"| "direccion" | "telefono" | "ciudad";
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((prev) => !prev);
    else { setSortKey(key); setSortAsc(true); }
  };

  useEffect(() => {
    if (user && user.id_role !== 1) router.replace("/dashboard");
  }, [user, router]);

  const fetchSucursales = async () => {
    setLoading(true);
    try {
      const data = await getSucursales();
      setSucursales(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSucursales();
    getStates().then(setStates);
  }, []);

  const openNew = () => {
    setForm({ ...EMPTY });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (s: ISucursal) => {
    setForm({
      id_sucursal: s.id_sucursal,
      nombre: s.nombre,
      ciudad: s.ciudad,
      direccion: s.direccion,
      telefono: s.telefono,
      id_state: s.id_state ?? null,
    });
    setError(null);
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleStateChange = (id_state: number | null) => {
    setForm((prev) => ({ ...prev, id_state }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await saveSucursal(form);
      if (!res.ok) throw new Error(res.message ?? "Error al guardar");
      setShowModal(false);
      await fetchSucursales();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const normalize = (val: string | null | undefined) => (val ?? "").toLowerCase();

  const sucursalesFiltradas = sucursales
    .filter((s) => {
      const q = search.toLowerCase();
      return (
        normalize(s.nombre).includes(q) ||
        normalize(s.direccion).includes(q) ||
        normalize(s.telefono).includes(q)
      );
    })
    .sort((a, b) => {
      if (!sortKey) return 0;
      const va = normalize(a[sortKey]);
      const vb = normalize(b[sortKey]);
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortAsc ? "▲" : "▼") : <span className="opacity-30">▲</span>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-50">Sucursales</h2>
        <button
          onClick={openNew}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
        >
          + Nueva sucursal
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre, dirección o teléfono…"
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
                {(["nombre","estado","ciudad", "direccion", "telefono" ] as SortKey[]).map((key, i) => (
                  <React.Fragment key={key}>
                    {/* {i === 1 && (
                      <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                        Estado
                      </th>
                    )} */}
                    <th
                      onClick={() => toggleSort(key)}
                      className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                      <span className="ml-1 text-xs">{sortIndicator(key)}</span>
                    </th>
                  </React.Fragment>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
              {sucursalesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                    Sin registros
                  </td>
                </tr>
              ) : (
                sucursalesFiltradas.map((s) => (
                  <SucursalFila
                    key={s.id_sucursal}
                    sucursal={s}
                    onEdit={openEdit}
                    onDeleted={fetchSucursales}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <SucursalModal
          form={form}
          states={states}
          saving={saving}
          error={error}
          onChange={handleChange}
          onStateChange={handleStateChange}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
