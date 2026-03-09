"use client";

import { useAuth } from "@/contexts/AuthContext";
import { IRole } from "@/interfaces/roles";
import { IUser } from "@/interfaces/user";
import { useEffect, useState } from "react";
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
                <UsuarioFila key={u.id_user} usuario={u} roles={roles} onEdit={openEdit} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <UsuarioModal
          form={form}
          roles={roles}
          saving={saving}
          error={error}
          onChange={handleChange}
          onStatusChange={(checked) => setForm((prev) => ({ ...prev, status: checked }))}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
