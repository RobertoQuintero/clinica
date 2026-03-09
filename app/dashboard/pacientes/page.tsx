"use client";

import { useAuth } from "@/contexts/AuthContext";
import { IPaciente } from "@/interfaces/paciente";
import { useEffect, useState } from "react";
import PacienteFila from "./componentes/PacienteFila";
import PacienteModal from "./componentes/PacienteModal";

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
                <PacienteFila key={p.id_paciente} paciente={p} onEdit={openEdit} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <PacienteModal
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
