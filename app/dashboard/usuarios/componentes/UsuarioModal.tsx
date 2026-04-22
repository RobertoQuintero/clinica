"use client";

import { IRole } from "@/interfaces/roles";
import { ISucursal } from "@/interfaces/sucursal";
import { IUser } from "@/interfaces/user";
import { useState } from "react";

interface Props {
  form: IUser;
  roles: IRole[];
  sucursales: ISucursal[];
  saving: boolean;
  error: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onStatusChange: (checked: boolean) => void;
  onIdSucursalChange: (id: number) => void;
  onSucursalesStringChange: (id: number) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function UsuarioModal({ form, roles, sucursales, saving, error, onChange, onStatusChange, onIdSucursalChange, onSucursalesStringChange, onSubmit, onClose }: Props) {
  const selectedIds = (form.sucursales_string ?? "").split(",").filter(Boolean);
  const [sucursalQuery, setSucursalQuery] = useState("");
  const [showSucursalList, setShowSucursalList] = useState(false);
  const selectedSucursal = sucursales.find((s) => s.id_sucursal === Number(form.id_sucursal));
  const filteredSucursales = sucursales.filter((s) =>
    sucursalQuery === "" ||
    s.nombre.toLowerCase().includes(sucursalQuery.toLowerCase()) ||
    (s.ciudad ?? "").toLowerCase().includes(sucursalQuery.toLowerCase())
  );

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
          <div className="col-span-1 sm:col-span-2 flex flex-col gap-1 relative">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Sucursal principal</span>
            <input
              type="text"
              placeholder={selectedSucursal ? `${selectedSucursal.nombre} — ${selectedSucursal.ciudad ?? ""}` : "Buscar sucursal..."}
              value={sucursalQuery}
              onChange={(e) => { setSucursalQuery(e.target.value); setShowSucursalList(true); }}
              onFocus={() => setShowSucursalList(true)}
              onBlur={() => setTimeout(() => setShowSucursalList(false), 150)}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
            {showSucursalList && filteredSucursales.length > 0 && (
              <ul className="absolute top-full left-0 right-0 z-50 mt-1 max-h-40 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg">
                {filteredSucursales.map((s) => (
                  <li
                    key={s.id_sucursal}
                    onMouseDown={() => {
                      onIdSucursalChange(s.id_sucursal);
                      setSucursalQuery("");
                      setShowSucursalList(false);
                    }}
                    className={`cursor-pointer px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                      s.id_sucursal === Number(form.id_sucursal)
                        ? "font-semibold text-zinc-900 dark:text-zinc-50"
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {s.nombre} — {s.ciudad}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="col-span-1 sm:col-span-2 flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Sucursales</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2">
              {sucursales.length === 0 && (
                <p className="text-sm text-zinc-400 col-span-2">Sin sucursales disponibles</p>
              )}
              {sucursales.map((s) => (
                <label key={s.id_sucursal} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(String(s.id_sucursal))}
                    onChange={() => onSucursalesStringChange(s.id_sucursal)}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {s.nombre} — {s.ciudad}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 pt-1">
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

