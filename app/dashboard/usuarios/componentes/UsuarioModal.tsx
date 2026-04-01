"use client";

import { IRole } from "@/interfaces/roles";
import { ISucursal } from "@/interfaces/sucursal";
import { IUser } from "@/interfaces/user";
import { useRef, useState } from "react";

interface Props {
  form: IUser;
  roles: IRole[];
  sucursales: ISucursal[];
  saving: boolean;
  error: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onStatusChange: (checked: boolean) => void;
  onSucursalChange: (id: number) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function UsuarioModal({ form, roles, sucursales, saving, error, onChange, onStatusChange, onSucursalChange, onSubmit, onClose }: Props) {
  const sucursalLabel = (id: number) => {
    const s = sucursales.find((s) => s.id_sucursal === id);
    return s ? `${s.nombre} — ${s.ciudad}` : "";
  };

  const [sucursalQuery, setSucursalQuery] = useState(() => sucursalLabel(form.id_sucursal));
  const [showSugerencias, setShowSugerencias] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const sugerencias = sucursalQuery.trim() === ""
    ? sucursales
    : sucursales.filter((s) =>
        `${s.nombre} ${s.ciudad}`.toLowerCase().includes(sucursalQuery.toLowerCase())
      );

  const handleSucursalInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSucursalQuery(e.target.value);
    setShowSugerencias(true);
    if (e.target.value.trim() === "") onSucursalChange(0);
  };

  const selectSucursal = (s: ISucursal) => {
    setSucursalQuery(`${s.nombre} — ${s.ciudad}`);
    onSucursalChange(s.id_sucursal);
    setShowSugerencias(false);
  };

  const handleSucursalBlur = () => {
    // pequeño delay para permitir click en sugerencia
    setTimeout(() => setShowSugerencias(false), 150);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-50">
            {form.id_user === 0 ? "Nuevo usuario" : "Editar usuario"}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={onSubmit} className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {error && (
            <p className="col-span-2 rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Nombre</span>
            <input type="text" name="nombre" value={form.nombre} onChange={onChange} required
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Email</span>
            <input type="email" name="email" value={form.email} onChange={onChange} required
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Teléfono</span>
            <input type="text" name="telefono" value={form.telefono} onChange={onChange}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400" />
          </label>
          {form.id_user === 0 && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Contraseña</span>
              <input type="password" name="password_hash" value={form.password_hash} onChange={onChange}
                required
                className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400" />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Rol</span>
            <select name="id_role" value={form.id_role} onChange={onChange} required
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400">
              <option value={0}>Seleccionar</option>
              {roles.map((r) => (
                <option key={r.id_role} value={r.id_role}>{r.nombre}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Sucursal</span>
            <div ref={containerRef} className="relative">
              <input
                type="text"
                value={sucursalQuery}
                onChange={handleSucursalInput}
                onFocus={() => setShowSugerencias(true)}
                onBlur={handleSucursalBlur}
                placeholder="Buscar sucursal..."
                autoComplete="off"
                required={form.id_sucursal === 0}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
              {showSugerencias && sugerencias.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-lg text-sm">
                  {sugerencias.map((s) => (
                    <li
                      key={s.id_sucursal}
                      onMouseDown={() => selectSucursal(s)}
                      className="cursor-pointer px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100"
                    >
                      {s.nombre} — {s.ciudad}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </label>
          <label className="flex items-center gap-2 pt-5">
            <input type="checkbox" name="status" checked={!!form.status}
              onChange={(e) => onStatusChange(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300" />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">Activo</span>
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
