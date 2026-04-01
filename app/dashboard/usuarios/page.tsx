"use client";

import { useAuth } from "@/contexts/AuthContext";
import { IRole } from "@/interfaces/roles";
import { ISucursal } from "@/interfaces/sucursal";
import { IUser } from "@/interfaces/user";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import UsuarioFila from "./componentes/UsuarioFila";
import UsuarioModal from "./componentes/UsuarioModal";

const EMPTY: IUser = {
  id_user:       0,
  nombre:        "",
  email:         "",
  telefono:      "",
  password_hash: "",
  id_role:       0,
  status:        true,
  created_at:    "",
  updated_at:    "",
  deleted_at:    "",
  id_sucursal:   0,
  id_empresa:    0,
};

export default function UsuariosPage() {
  const { user }                  = useAuth();
  const router                    = useRouter();
  const [usuarios, setUsuarios]   = useState<IUser[]>([]);
  const [roles, setRoles]         = useState<IRole[]>([]);
  const [sucursales, setSucursales] = useState<ISucursal[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState<IUser>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const [search, setSearch] = useState("");

  type SortKey = "nombre" | "email" | "telefono" | "id_role" | "id_sucursal" | "status";
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((prev) => !prev);
    else { setSortKey(key); setSortAsc(true); }
  };

  useEffect(() => {
    if (user && user.id_role !== 1) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const fetchUsuarios = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/users?id_sucursal=${user.id_sucursal}&id_empresa=${user.id_empresa}`
      );
      const data = await res.json();
      if (data.ok) setUsuarios(data.data);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    const res = await fetch("/api/roles");
    const data = await res.json();
    if (data.ok) setRoles(data.data);
  };

  const fetchSucursales = async () => {
    if (!user) return;
    const res = await fetch(
      `/api/sucursales?id_empresa=${user.id_empresa}&status=1&activo=1`
    );
    const data = await res.json();
    if (data.ok) setSucursales(data.data);
  };

  useEffect(() => {
    fetchUsuarios();
    fetchRoles();
    fetchSucursales();
  }, [user]);

  const openNew = () => {
    setForm({ ...EMPTY, id_sucursal: user!.id_sucursal, id_empresa: user!.id_empresa });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (u: IUser) => {
    setForm({ ...u, password_hash: "" });
    setError(null);
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.data ?? "Error al guardar");
      setShowModal(false);
      await fetchUsuarios();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const usuariosFiltrados = [...usuarios]
    .filter((u) =>
      search.trim() === "" ||
      u.nombre.toLowerCase().includes(search.trim().toLowerCase())
    )
    .sort((a, b) => {
      if (!sortKey) return 0;
      const va = String(a[sortKey] ?? "").toLowerCase();
      const vb = String(b[sortKey] ?? "").toLowerCase();
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-50">Usuarios</h2>
        {/* <button
          onClick={openNew}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
        >
          + Nuevo usuario
        </button> */}
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
        />
      </div>

      {loading ? (
        <p className="text-zinc-500">Cargando...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                {([
                  { label: "Nombre",    key: "nombre"      },
                  { label: "Email",     key: "email"       },
                  { label: "Teléfono",  key: "telefono"    },
                  { label: "Rol",       key: "id_role"     },
                  { label: "Sucursal",  key: "id_sucursal" },
                  { label: "Activo",    key: "status"      },
                ] as { label: string; key: SortKey }[]).map(({ label, key }) => (
                  <th
                    key={key}
                    onClick={() => toggleSort(key)}
                    className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    {label}
                    <span className="ml-1 text-xs">
                      {sortKey === key ? (sortAsc ? "▲" : "▼") : <span className="opacity-30">▲</span>}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">Sin registros</td>
                </tr>
              ) : usuariosFiltrados.map((u) => (
                <UsuarioFila key={u.id_user} usuario={u} roles={roles} sucursales={sucursales} onEdit={openEdit} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <UsuarioModal
          form={form}
          roles={roles}
          sucursales={sucursales}
          saving={saving}
          error={error}
          onChange={handleChange}
          onStatusChange={(checked) => setForm((prev) => ({ ...prev, status: checked }))}
          onSucursalChange={(id) => setForm((prev) => ({ ...prev, id_sucursal: id }))}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
