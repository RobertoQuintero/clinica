"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ICita } from "@/interfaces/cita";
import { IPaciente } from "@/interfaces/paciente";
import { IUser } from "@/interfaces/user";
import { useEffect, useState } from "react";
import CitaFila from "./componentes/CitaFila";
import CitaModal from "./componentes/CitaModal";

const EMPTY: ICita = {
  id_cita:            0,
  id_paciente:        0,
  id_podologo:        0,
  fecha_inicio:       "",
  fecha_fin:          "",
  estado:             "agendada",
  motivo_cancelacion: "",
  created_at:         "",
  deleted_at:         "",
  id_sucursal:        0,
  id_empresa:         0,
};

export default function CitasPage() {
  const { user }                  = useAuth();
  const [citas, setCitas]         = useState<ICita[]>([]);
  const [pacientes, setPacientes] = useState<IPaciente[]>([]);
  const [podologos, setPodologos] = useState<IUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState<ICita>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const fetchCitas = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/citas?id_sucursal=${user.id_sucursal}&id_empresa=${user.id_empresa}`
      );
      const data = await res.json();
      if (data.ok) setCitas(data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchCitas();
    // Fetch pacientes y usuarios (podólogos) del mismo contexto
    fetch(`/api/pacientes?id_sucursal=${user.id_sucursal}&id_empresa=${user.id_empresa}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setPacientes(d.data); });
    fetch(`/api/users?id_sucursal=${user.id_sucursal}&id_empresa=${user.id_empresa}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setPodologos(d.data); });
  }, [user]);

  const openNew = () => {
    setForm({ ...EMPTY, id_sucursal: user!.id_sucursal, id_empresa: user!.id_empresa });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (c: ICita) => {
    setForm({ ...c });
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
      const res = await fetch("/api/citas", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.data ?? "Error al guardar");
      setShowModal(false);
      fetchCitas(); // fire-and-forget — save already confirmed, don't let refresh errors affect the modal
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const handleChangeEstado = async (id_cita: number, estado: string) => {
    const cita = citas.find((c) => c.id_cita === id_cita);
    if (!cita) return;
    // Optimistic update
    setCitas((prev) => prev.map((c) => c.id_cita === id_cita ? { ...c, estado } : c));
    try {
      const res = await fetch("/api/citas", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...cita, estado }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.data ?? "Error al actualizar");
    } catch {
      // Revert on failure
      setCitas((prev) => prev.map((c) => c.id_cita === id_cita ? { ...c, estado: cita.estado } : c));
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-50">Citas</h2>
        <button
          onClick={openNew}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
        >
          + Nueva cita
        </button>
      </div>

      {loading ? (
        <p className="text-zinc-500">Cargando...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                {[ "Paciente", "Podólogo", "Inicio", "Fin", "Estado", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
              {citas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">Sin registros</td>
                </tr>
              ) : [...citas].sort((a, b) => {
                  const aCan = a.estado.toLowerCase() === "cancelada" ? 1 : 0;
                  const bCan = b.estado.toLowerCase() === "cancelada" ? 1 : 0;
                  if (aCan !== bCan) return aCan - bCan;
                  const tA = new Date(String(a.fecha_inicio).replace(" ", "T")).getTime();
                  const tB = new Date(String(b.fecha_inicio).replace(" ", "T")).getTime();
                  return tB - tA;
                }).map((c) => (
                <CitaFila key={c.id_cita} cita={c} pacientes={pacientes} podologos={podologos} onEdit={openEdit} onChangeEstado={handleChangeEstado} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <CitaModal
          form={form}
          pacientes={pacientes}
          podologos={podologos}
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
