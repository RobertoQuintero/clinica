"use client";

import { IConsulta } from "@/interfaces/consulta";
import { ISucursal } from "@/interfaces/sucursal";
import { IUser } from "@/interfaces/user";
import { toDateTimeLocal } from "@/utils/date_helpper";
import { useEffect, useState } from "react";

interface Props {
  form: IConsulta;
  saving: boolean;
  error: string | null;
  podologos: IUser[];
  sucursales: ISucursal[];
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onPodologoChange: (id: number) => void;
  onSucursalChange: (id: number) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function ConsultaModal({ form, saving, error, podologos, sucursales, onChange, onPodologoChange, onSucursalChange, onSubmit, onClose }: Props) {
  const [podologoInput, setPodologoInput] = useState("");
  const [sucursalInput, setSucursalInput] = useState("");

  useEffect(() => {
    const found = podologos.find((p) => p.id_user === form.id_podologo);
    setPodologoInput(found?.nombre ?? "");
  }, [form.id_podologo, podologos]);

  useEffect(() => {
    const found = sucursales.find((s) => s.id_sucursal === form.id_sucursal);
    setSucursalInput(found ? (found.ciudad ?? found.nombre) : "");
  }, [form.id_sucursal, sucursales]);

  const handlePodologoInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPodologoInput(val);
    const found = podologos.find((p) => p.nombre === val);
    if (found) onPodologoChange(found.id_user);
  };

  const sucursalLabel = (s: ISucursal) => s.ciudad ?? s.nombre;

  const handleSucursalInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSucursalInput(val);
    const found = sucursales.find((s) => sucursalLabel(s) === val);
    if (found) {
      onSucursalChange(found.id_sucursal);
      setPodologoInput("");
      onPodologoChange(0);
    }
  };

  const handleSucursalFocus = () => setSucursalInput("");

  const handleSucursalBlur = () => {
    const found = sucursales.find((s) => s.id_sucursal === form.id_sucursal);
    setSucursalInput(found ? sucursalLabel(found) : "");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-50">
            {form.id_consulta === 0 ? "Nueva consulta" : "Editar consulta"}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {error && (
            <p className="col-span-2 rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Fecha</span>
            <input
              type="datetime-local"
              name="fecha"
              value={toDateTimeLocal(String(form.fecha ?? ""))}
              onChange={onChange}
              required
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Sucursal</span>
            <input
              type="text"
              list="sucursales-list"
              value={sucursalInput}
              onChange={handleSucursalInput}
              onFocus={handleSucursalFocus}
              onBlur={handleSucursalBlur}
              placeholder="Buscar sucursal…"
              required
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
            <datalist id="sucursales-list">
              {sucursales.map((s) => (
                <option key={s.id_sucursal} value={s.ciudad!} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Podólogo</span>
            <input
              type="text"
              list="podologos-list"
              value={podologoInput}
              onChange={handlePodologoInput}
              placeholder={form.id_sucursal ? "Buscar podólogo…" : "Selecciona una sucursal primero"}
              disabled={!form.id_sucursal}
              required
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <datalist id="podologos-list">
              {podologos.map((p) => (
                <option key={p.id_user} value={p.nombre} />
              ))}
            </datalist>
          </label>

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
