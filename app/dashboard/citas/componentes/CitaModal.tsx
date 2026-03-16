"use client";

import { ICita } from "@/interfaces/cita";
import { IPaciente } from "@/interfaces/paciente";
import { IUser } from "@/interfaces/user";
import { toDateTimeLocal } from "@/utils/date_helpper";
import { useEffect, useRef, useState } from "react";

const ESTADOS = ["agendada", "atendida", "cancelada"];

interface Props {
  form: ICita;
  pacientes: IPaciente[];
  podologos: IUser[];
  saving: boolean;
  error: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function CitaModal({ form, pacientes, podologos, saving, error, onChange, onSubmit, onClose }: Props) {
  const [pacienteQuery, setPacienteQuery] = useState("");
  const [podologoQuery, setPodologoQuery] = useState("");
  const [showPacientes, setShowPacientes] = useState(false);
  const [showPodologos, setShowPodologos] = useState(false);
  const pacienteRef = useRef<HTMLDivElement>(null);
  const podologoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = pacientes.find((p) => p.id_paciente === form.id_paciente);
    setPacienteQuery(p ? `${p.nombre} ${p.apellido_paterno}` : "");
  }, [form.id_paciente, pacientes]);

  useEffect(() => {
    const u = podologos.find((u) => u.id_user === form.id_podologo);
    setPodologoQuery(u ? u.nombre : "");
  }, [form.id_podologo, podologos]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pacienteRef.current && !pacienteRef.current.contains(e.target as Node))
        setShowPacientes(false);
      if (podologoRef.current && !podologoRef.current.contains(e.target as Node))
        setShowPodologos(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredPacientes = pacientes.filter((p) =>
    `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno}`.toLowerCase().includes(pacienteQuery.toLowerCase())
  );

  const filteredPodologos = podologos
    .filter((u) => u.id_role === 2)
    .filter((u) => u.nombre.toLowerCase().includes(podologoQuery.toLowerCase()));

  const selectPaciente = (p: IPaciente) => {
    setPacienteQuery(`${p.nombre} ${p.apellido_paterno}`);
    setShowPacientes(false);
    onChange({ target: { name: "id_paciente", value: String(p.id_paciente) } } as React.ChangeEvent<HTMLSelectElement>);
  };

  const selectPodologo = (u: IUser) => {
    setPodologoQuery(u.nombre);
    setShowPodologos(false);
    onChange({ target: { name: "id_podologo", value: String(u.id_user) } } as React.ChangeEvent<HTMLSelectElement>);
  };

  const handleFechaInicio = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
    if (e.target.value) {
      const end = new Date(new Date(e.target.value).getTime() + 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const fechaFin = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
      onChange({ target: { name: "fecha_fin", value: fechaFin } } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-50">
            {form.id_cita === 0 ? "Nueva cita" : "Editar cita"}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={onSubmit} className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {error && (
            <p className="col-span-2 rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Paciente</span>
            <div ref={pacienteRef} className="relative">
              <input
                type="text"
                value={pacienteQuery}
                onChange={(e) => { setPacienteQuery(e.target.value); setShowPacientes(true); }}
                onFocus={() => setShowPacientes(true)}
                placeholder="Buscar paciente…"
                autoComplete="off"
                required
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
              {showPacientes && filteredPacientes.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg text-sm">
                  {filteredPacientes.map((p) => (
                    <li
                      key={p.id_paciente}
                      onMouseDown={() => selectPaciente(p)}
                      className="cursor-pointer px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100"
                    >
                      {p.nombre} {p.apellido_paterno}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Podólogo</span>
            <div ref={podologoRef} className="relative">
              <input
                type="text"
                value={podologoQuery}
                onChange={(e) => { setPodologoQuery(e.target.value); setShowPodologos(true); }}
                onFocus={() => setShowPodologos(true)}
                placeholder="Buscar podólogo…"
                autoComplete="off"
                required
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
              {showPodologos && filteredPodologos.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg text-sm">
                  {filteredPodologos.map((u) => (
                    <li
                      key={u.id_user}
                      onMouseDown={() => selectPodologo(u)}
                      className="cursor-pointer px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100"
                    >
                      {u.nombre}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Fecha inicio</span>
            <input type="datetime-local" name="fecha_inicio"
              value={toDateTimeLocal(String(form.fecha_inicio ?? ""))}
              onChange={handleFechaInicio} required
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Fecha fin</span>
            <input type="datetime-local" name="fecha_fin"
              value={toDateTimeLocal(String(form.fecha_fin ?? ""))}
              onChange={onChange}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Estado</span>
            <select name="estado" value={form.estado} onChange={onChange}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400">
              {ESTADOS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </label>
          {(form.estado === "cancelada") && (
            <label className="col-span-1 sm:col-span-2 flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Motivo de cancelación</span>
              <textarea
                name="motivo_cancelacion"
                value={form.motivo_cancelacion ?? ""}
                onChange={onChange}
                rows={2}
                className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-none"
              />
            </label>
          )}
          <div className="col-span-1 sm:col-span-2 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
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
  );
}
