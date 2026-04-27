"use client";

import { IServicioOpcion } from "@/interfaces/servicio_opcion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getServicio,
  getOpcionesServicio,
  saveOpcionServicio,
} from "./actions";
import OpcionFila from "./componentes/OpcionFila";
import OpcionModal from "./componentes/OpcionModal";

type FormData = Omit<IServicioOpcion, "id_sucursal" | "status">;

function makeEmpty(id_servicio: number): FormData {
  return { id_servicio_opcion: 0, id_servicio, nombre: "", descripcion: "", precio: 0 };
}

interface Props {
  params: Promise<{ id_servicio: string }>;
}

export default function OpcionesServicioPage({ params }: Props) {
  const { id_servicio: id_servicio_str } = use(params);
  const id_servicio = Number(id_servicio_str);

  const { user } = useAuth();
  const readOnly = user?.id_role === 2 || user?.id_role === 3;

  const router = useRouter();

  const [nombreServicio, setNombreServicio] = useState<string>("");
  const [opciones, setOpciones]             = useState<IServicioOpcion[]>([]);
  const [loading, setLoading]               = useState(true);
  const [showModal, setShowModal]           = useState(false);
  const [form, setForm]                     = useState<FormData>(makeEmpty(id_servicio));
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [search, setSearch]                 = useState("");

  type SortKey = "nombre" | "descripcion" | "precio";
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((prev) => !prev);
    else { setSortKey(key); setSortAsc(true); }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [servicio, data] = await Promise.all([
        getServicio(id_servicio),
        getOpcionesServicio(id_servicio),
      ]);
      setNombreServicio(servicio?.nombre ?? String(id_servicio));
      setOpciones(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id_servicio]);

  const openNew = () => {
    setForm(makeEmpty(id_servicio));
    setError(null);
    setShowModal(true);
  };

  const openEdit = (o: IServicioOpcion) => {
    setForm({
      id_servicio_opcion: o.id_servicio_opcion,
      id_servicio:        o.id_servicio,
      nombre:             o.nombre,
      descripcion:        o.descripcion,
      precio:             o.precio,
    });
    setError(null);
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await saveOpcionServicio(form);
      if (!res.ok) throw new Error(res.message ?? "Error al guardar");
      setShowModal(false);
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const opcionesFiltradas = opciones
    .filter((o) =>
      (o.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (o.descripcion ?? "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortKey) return 0;
      if (sortKey === "precio") {
        return sortAsc ? a.precio - b.precio : b.precio - a.precio;
      }
      const va = String(a[sortKey]).toLowerCase();
      const vb = String(b[sortKey]).toLowerCase();
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/servicios")}
            className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
          >
            ← Servicios
          </button>
          <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-50">
            Opciones — <span className="text-zinc-500 dark:text-zinc-400">{nombreServicio}</span>
          </h2>
        </div>
        {!readOnly && (
          <button
            onClick={openNew}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
          >
            + Nueva opción
          </button>
        )}
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por descripción…"
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
                <th
                  onClick={() => toggleSort("descripcion")}
                  className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Descripción
                  <span className="ml-1 text-xs">
                    {sortKey === "descripcion" ? (sortAsc ? "▲" : "▼") : <span className="opacity-30">▲</span>}
                  </span>
                </th>
                <th
                  onClick={() => toggleSort("precio")}
                  className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Precio
                  <span className="ml-1 text-xs">
                    {sortKey === "precio" ? (sortAsc ? "▲" : "▼") : <span className="opacity-30">▲</span>}
                  </span>
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
              {opcionesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                    Sin registros
                  </td>
                </tr>
              ) : (
                opcionesFiltradas.map((o) => (
                  <OpcionFila
                    key={o.id_servicio_opcion}
                    opcion={o}
                    onEdit={openEdit}
                    onDeleted={fetchData}
                    readOnly={readOnly}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <OpcionModal
          form={form}
          saving={saving}
          error={error}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
