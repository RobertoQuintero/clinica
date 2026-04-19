"use client";

import { ICatState, ISucursal } from "@/interfaces/sucursal";
import { useState, useRef, useEffect } from "react";

type FormData = Pick<ISucursal, "id_sucursal" | "nombre" | "ciudad" | "direccion" | "telefono" | "id_state">;

interface Props {
  form: FormData;
  states: ICatState[];
  saving: boolean;
  error: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStateChange: (id_state: number | null) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function SucursalModal({ form, states, saving, error, onChange, onStateChange, onSubmit, onClose }: Props) {
  const selectedState = states.find((s) => s.id_state === form.id_state) ?? null;
  const [query, setQuery] = useState(selectedState?.description ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync query label when form.id_state changes from outside (openEdit)
  useEffect(() => {
    const match = states.find((s) => s.id_state === form.id_state);
    setQuery(match?.description ?? "");
  }, [form.id_state, states]);

  const filtered = query.trim()
    ? states.filter((s) => s.description.toLowerCase().includes(query.toLowerCase()))
    : states;

  const handleSelect = (s: ICatState) => {
    setQuery(s.description);
    onStateChange(s.id_state);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    onStateChange(null);
    setOpen(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-50">
            {form.id_sucursal === 0 ? "Nueva sucursal" : "Editar sucursal"}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 flex flex-col gap-4">
          {error && (
            <p className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Nombre</span>
            <input
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={onChange}
              required
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </label>

          {/* Estado autocomplete */}
          <div className="flex flex-col gap-1" ref={containerRef}>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Estado</span>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); onStateChange(null); }}
                onFocus={() => setOpen(true)}
                placeholder="Buscar estado…"
                autoComplete="off"
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 pr-8 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
                >
                  &times;
                </button>
              )}
              {open && filtered.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-lg text-sm">
                  {filtered.map((s) => (
                    <li
                      key={s.id_state}
                      onMouseDown={() => handleSelect(s)}
                      className={`cursor-pointer px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                        form.id_state === s.id_state ? "bg-zinc-100 dark:bg-zinc-700 font-medium" : ""
                      }`}
                    >
                      {s.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Ciudad</span>
            <input
              type="text"
              name="ciudad"
              value={form.ciudad ?? ""}
              onChange={onChange}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Dirección</span>
            <input
              type="text"
              name="direccion"
              value={form.direccion ?? ""}
              onChange={onChange}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Teléfono</span>
            <input
              type="text"
              name="telefono"
              value={form.telefono ?? ""}
              onChange={onChange}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </label>

          <div className="flex justify-end gap-3 pt-2">
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
