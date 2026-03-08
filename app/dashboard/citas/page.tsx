"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ICita } from "@/interfaces/cita";
import { IPaciente } from "@/interfaces/paciente";
import { IUser } from "@/interfaces/user";
import { useEffect, useState } from "react";

const EMPTY: ICita = {
  id_cita:            0,
  id_paciente:        0,
  id_podologo:        0,
  fecha_inicio:       "",
  fecha_fin:          "",
  estado:             "pendiente",
  motivo_cancelacion: "",
  created_at:         "",
  deleted_at:         "",
  id_sucursal:        0,
  id_empresa:         0,
};

const ESTADOS = ["pendiente", "confirmada", "completada", "cancelada"];

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
      await fetchCitas();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const pacienteName = (id: number) => {
    const p = pacientes.find((x) => x.id_paciente === id);
    return p ? `${p.nombre} ${p.apellido_paterno}` : id;
  };

  const podologoName = (id: number) => {
    const u = podologos.find((x) => x.id_user === id);
    return u ? u.nombre : id;
  };

  const estadoBadge = (estado: string) => {
    const map: Record<string, string> = {
      pendiente:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      confirmada: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      completada: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      cancelada:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    return map[estado] ?? "bg-zinc-100 text-zinc-500";
  };

  const fmtDate = (d: Date | string) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
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
                {["#", "Paciente", "Podólogo", "Inicio", "Fin", "Estado", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
              {citas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">Sin registros</td>
                </tr>
              ) : citas.map((c) => (
                <tr key={c.id_cita} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 text-zinc-500">{c.id_cita}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{pacienteName(c.id_paciente)}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{podologoName(c.id_podologo)}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">{fmtDate(c.fecha_inicio)}</td>
                  <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100 whitespace-nowrap">{fmtDate(c.fecha_fin)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${estadoBadge(c.estado)}`}>
                      {c.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(c)}
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
                {form.id_cita === 0 ? "Nueva cita" : "Editar cita"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {error && (
                <p className="col-span-2 rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Paciente</span>
                <select name="id_paciente" value={form.id_paciente} onChange={handleChange} required
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400">
                  <option value={0}>Seleccionar</option>
                  {pacientes.map((p) => (
                    <option key={p.id_paciente} value={p.id_paciente}>
                      {p.nombre} {p.apellido_paterno}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Podólogo</span>
                <select name="id_podologo" value={form.id_podologo} onChange={handleChange} required
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400">
                  <option value={0}>Seleccionar</option>
                  {podologos.map((u) => (
                    <option key={u.id_user} value={u.id_user}>{u.nombre}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Fecha inicio</span>
                <input type="datetime-local" name="fecha_inicio"
                  value={form.fecha_inicio ? String(form.fecha_inicio).slice(0, 16) : ""}
                  onChange={handleChange} required
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Fecha fin</span>
                <input type="datetime-local" name="fecha_fin"
                  value={form.fecha_fin ? String(form.fecha_fin).slice(0, 16) : ""}
                  onChange={handleChange}
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Estado</span>
                <select name="estado" value={form.estado} onChange={handleChange}
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400">
                  {ESTADOS.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </label>
              {form.estado === "cancelada" && (
                <label className="col-span-1 sm:col-span-2 flex flex-col gap-1">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Motivo de cancelación</span>
                  <textarea
                    name="motivo_cancelacion"
                    value={form.motivo_cancelacion ?? ""}
                    onChange={handleChange}
                    rows={2}
                    className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-none"
                  />
                </label>
              )}
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
