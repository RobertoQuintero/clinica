"use client";

import { IProducto } from "@/interfaces/producto";
import { useEffect, useState } from "react";
import { getProductos, saveProducto } from "./actions";
import ProductoFila from "./componentes/ProductoFila";
import ProductoModal from "./componentes/ProductoModal";

type FormData = Pick<IProducto, "id_producto" | "nombre" | "precio" | "descripcion">;

const EMPTY: FormData = { id_producto: 0, nombre: "", precio: 0, descripcion: "" };

export default function ProductosPage() {
  const [productos, setProductos] = useState<IProducto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState<FormData>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");

  type SortKey = "nombre" | "precio";
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((prev) => !prev);
    else { setSortKey(key); setSortAsc(true); }
  };

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const data = await getProductos();
      setProductos(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProductos(); }, []);

  const openNew = () => {
    setForm({ ...EMPTY });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (p: IProducto) => {
    setForm({ id_producto: p.id_producto, nombre: p.nombre, precio: p.precio, descripcion: p.descripcion ?? "" });
    setError(null);
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "precio" ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await saveProducto(form);
      if (!res.ok) throw new Error(res.message ?? "Error al guardar");
      setShowModal(false);
      await fetchProductos();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const productosFiltrados = productos
    .filter((p) => p.nombre.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (!sortKey) return 0;
      if (sortKey === "precio") {
        return sortAsc ? a.precio - b.precio : b.precio - a.precio;
      }
      const va = a.nombre.toLowerCase();
      const vb = b.nombre.toLowerCase();
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-50">Productos</h2>
        <button
          onClick={openNew}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
        >
          + Nuevo producto
        </button>
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
                <th
                  onClick={() => toggleSort("precio")}
                  className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Precio
                  <span className="ml-1 text-xs">
                    {sortKey === "precio" ? (sortAsc ? "▲" : "▼") : <span className="opacity-30">▲</span>}
                  </span>
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300">Descripción</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                    Sin registros
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((p) => (
                  <ProductoFila
                    key={p.id_producto}
                    producto={p}
                    onEdit={openEdit}
                    onDeleted={fetchProductos}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ProductoModal
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
