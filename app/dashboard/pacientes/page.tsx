"use client";

import { useAuth } from "@/contexts/AuthContext";
import { IPaciente } from "@/interfaces/paciente";
import { useEffect, useState } from "react";

const EMPTY: IPaciente = {
  id_paciente:                  0,
  nombre:                       "",
  apellido_paterno:             "",
  apellido_materno:             "",
  telefono:                     "",
  whatsapp:                     "",
  fecha_nacimiento:             "",
  sexo:                         "",
  direccion:                    "",
  ciudad_preferida:             "",
  observaciones_generales:      "",
  contacto_emergencia_nombre:   "",
  contacto_emergencia_whatsapp: "",
  created_at:                   "",
  updated_at:                   "",
  deleted_at:                   "",
  id_sucursal:                  0,
  id_empresa:                   0,
};

export default function PacientesPage() {
  const { user } = useAuth();
  const [pacientes, setPacientes] = useState<IPaciente[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState<IPaciente>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const fetchPacientes = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pacientes?id_sucursal=${user.id_sucursal}&id_empresa=${user.id_empresa}`
      );
      const data = await res.json();
      if (data.ok) setPacientes(data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPacientes(); }, [user]);

  const openNew = () => {
    setForm({ ...EMPTY, id_sucursal: user!.id_sucursal, id_empresa: user!.id_empresa });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (p: IPaciente) => {
    setForm({ ...p });
    setError(null);
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/pacientes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.data ?? "Error al guardar");
      setShowModal(false);
      await fetchPacientes();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-50">Pacientes</h2>
        <button
          onClick={openNew}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
        >
          + Nuevo paciente
        </button>
      </div>

      {loading ? (
        <p className="text-zinc-500">Cargando...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                {["#", "Nombre", "Apellido paterno", "Apellido materno", "Teléfono", "Sexo", "Ciudad", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
              {pacientes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-zinc-400">Sin registros</td>
                </tr>
              ) : pacientes.map((p) => (
                <tr key={p.id_paciente} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 text-zinc-500">{p.id_paciente}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.nombre}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.apellido_paterno}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.apellido_materno}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.telefono}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.sexo}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{p.ciudad_preferida}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(p)}
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
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-50">
                {form.id_paciente === 0 ? "Nuevo paciente" : "Editar paciente"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {error && (
                <p className="col-span-2 rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              {(
                [
                  { name: "nombre",                       label: "Nombre",                       type: "text" },
                  { name: "apellido_paterno",             label: "Apellido paterno",             type: "text" },
                  { name: "apellido_materno",             label: "Apellido materno",             type: "text" },
                  { name: "telefono",                     label: "Teléfono",                     type: "text" },
                  { name: "whatsapp",                     label: "WhatsApp",                     type: "text" },
                  { name: "fecha_nacimiento",             label: "Fecha de nacimiento",          type: "date" },
                  { name: "direccion",                    label: "Dirección",                    type: "text" },
                  { name: "ciudad_preferida",             label: "Ciudad preferida",             type: "text" },
                  { name: "contacto_emergencia_nombre",   label: "Contacto emergencia nombre",   type: "text" },
                  { name: "contacto_emergencia_whatsapp", label: "Contacto emergencia WhatsApp", type: "text" },
                ] as { name: keyof IPaciente; label: string; type: string }[]
              ).map(({ name, label, type }) => (
                <label key={name} className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
                  <input
                    type={type}
                    name={name}
                    value={form[name] as string ?? ""}
                    onChange={handleChange}
                    className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </label>
              ))}
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Sexo</span>
                <select
                  name="sexo"
                  value={form.sexo}
                  onChange={handleChange}
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                >
                  <option value="">Seleccionar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </label>
              <label className="col-span-1 sm:col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Observaciones generales</span>
                <textarea
                  name="observaciones_generales"
                  value={form.observaciones_generales ?? ""}
                  onChange={handleChange}
                  rows={3}
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-none"
                />
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
