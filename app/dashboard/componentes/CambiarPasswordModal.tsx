"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cambiarPassword } from "@/app/dashboard/actions";

interface Props {
  onClose: () => void;
}

export default function CambiarPasswordModal({ onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    passwordActual: "",
    passwordNuevo: "",
    passwordConfirm: "",
  });

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }, []);

  if (!mounted) return null;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.passwordNuevo !== form.passwordConfirm) {
      setError("La nueva contraseña y su confirmación no coinciden");
      return;
    }

    if (form.passwordNuevo.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await cambiarPassword(form.passwordActual, form.passwordNuevo);

    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSuccess(true);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-zinc-900 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
            Cambiar contraseña
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="px-6 py-8 flex flex-col items-center gap-4 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Contraseña actualizada correctamente.
            </p>
            <button
              onClick={onClose}
              className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Contraseña actual
              </label>
              <input
                ref={firstInputRef}
                type="password"
                name="passwordActual"
                value={form.passwordActual}
                onChange={onChange}
                required
                autoComplete="current-password"
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Nueva contraseña
              </label>
              <input
                type="password"
                name="passwordNuevo"
                value={form.passwordNuevo}
                onChange={onChange}
                required
                autoComplete="new-password"
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Confirmar nueva contraseña
              </label>
              <input
                type="password"
                name="passwordConfirm"
                value={form.passwordConfirm}
                onChange={onChange}
                required
                autoComplete="new-password"
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              />
            </div>

            {error && (
              <p className="rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 transition-colors disabled:opacity-50"
              >
                {loading ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
