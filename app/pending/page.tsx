"use client";

import { useAuth } from "@/contexts/AuthContext";

export default function PendingPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-6">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-800 shadow-lg p-8 text-center">
        <div className="mb-4 flex justify-center">
          <div className="h-16 w-16 rounded-full bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-50 mb-2">
          En espera de autorización
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          Hola <span className="font-medium text-zinc-700 dark:text-zinc-300">{user?.nombre}</span>,
          tu cuenta ha sido registrada correctamente pero aún no ha sido activada.
          Por favor contacta a un administrador para que autorice tu acceso.
        </p>
        <button
          onClick={logout}
          className="w-full rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
