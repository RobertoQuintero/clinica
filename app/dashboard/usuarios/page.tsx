"use client";

import { useAuth } from "@/contexts/AuthContext";
import { IRole } from "@/interfaces/roles";
import { IUser } from "@/interfaces/user";
import { useEffect, useState } from "react";

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
  const [usuarios, setUsuarios]   = useState<IUser[]>([]);
  const [roles, setRoles]         = useState<IRole[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState<IUser>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

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

  useEffect(() => {
    fetchUsuarios();
    fetchRoles();
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

  const roleName = (id: number) => roles.find((r) => r.id_role === id)?.nombre ?? id;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-50">Usuarios</h2>
        <button
          onClick={openNew}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
        >
          + Nuevo usuario
        </button>
      </div>

      {loading ? (
        <p className="text-zinc-500">Cargando...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                {["#", "Nombre", "Email", "Teléfono", "Rol", "Activo", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">Sin registros</td>
                </tr>
              ) : usuarios.map((u) => (
                <tr key={u.id_user} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 text-zinc-500">{u.id_user}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{u.nombre}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{u.email}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{u.telefono}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{roleName(u.id_role)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${u.status ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"}`}>
                      {u.status ? "Sí" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(u)}
                      className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-50">
                {form.id_user === 0 ? "Nuevo usuario" : "Editar usuario"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {error && (
                <p className="col-span-2 rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Nombre</span>
                <input type="text" name="nombre" value={form.nombre} onChange={handleChange} required
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Email</span>
                <input type="email" name="email" value={form.email} onChange={handleChange} required
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Teléfono</span>
                <input type="text" name="telefono" value={form.telefono} onChange={handleChange}
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {form.id_user === 0 ? "Contraseña" : "Nueva contraseña (dejar vacío para no cambiar)"}
                </span>
                <input type="password" name="password_hash" value={form.password_hash} onChange={handleChange}
                  required={form.id_user === 0}
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Rol</span>
                <select name="id_role" value={form.id_role} onChange={handleChange} required
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400">
                  <option value={0}>Seleccionar</option>
                  {roles.map((r) => (
                    <option key={r.id_role} value={r.id_role}>{r.nombre}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 pt-5">
                <input type="checkbox" name="status" checked={!!form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.checked }))}
                  className="h-4 w-4 rounded border-zinc-300" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Activo</span>
              </label>
              <div className="col-span-1 sm:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
