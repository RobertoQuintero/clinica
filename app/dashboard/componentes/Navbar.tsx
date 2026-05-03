"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useSucursal } from "@/contexts/SucursalContext";
import { useTheme } from "@/contexts/ThemeContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import CambiarPasswordModal from "@/app/dashboard/componentes/CambiarPasswordModal";

const ALL_NAV_LINKS = [
  { href: "/dashboard/pacientes",  label: "Pacientes",  minRole: 0, excludeRoles: [] as number[] },
  { href: "/dashboard/usuarios",   label: "Usuarios",   minRole: 0, excludeRoles: [2, 3] },
  { href: "/dashboard/citas",      label: "Citas",      minRole: 0, excludeRoles: [] as number[] },
  { href: "/dashboard/servicios",  label: "Servicios",  minRole: 0, excludeRoles: [] as number[] },
  { href: "/dashboard/productos",  label: "Productos",  minRole: 0, excludeRoles: [] as number[] },
  { href: "/dashboard/sucursales", label: "Sucursales", minRole: 0, excludeRoles: [] as number[] },
  { href: "/dashboard/enlaces",    label: "Enlaces",    minRole: 0, excludeRoles: [3] },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { sucursales, selectedId, setSelected } = useSucursal();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);

  const navLinks = ALL_NAV_LINKS.filter(
    (l) =>
      (l.minRole === 0 || (user?.id_role ?? 0) === l.minRole) &&
      !l.excludeRoles.includes(user?.id_role ?? 0)
  );
  return (
    <>
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-white shadow-sm dark:bg-zinc-800">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="text-xl font-bold text-zinc-800 dark:text-zinc-50 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          Pie Zen
        </Link>

        {/* Nav links — only on large screens */}
        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                pathname.startsWith(href)
                  ? "bg-zinc-800 text-white dark:bg-zinc-600"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {label}
            </Link>
          ))}
          {/* Sucursal selector */}
          {sucursales.length > 1 && (
            <select
              value={selectedId}
              onChange={(e) => setSelected(Number(e.target.value))}
              className="ml-2 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 shadow-sm transition-colors hover:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
            >
              {sucursales.map((s) => (
                <option key={s.id_sucursal} value={s.id_sucursal}>
                  {s.nombre}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* User + logout — only on large screens */}
        <div className="hidden lg:flex items-center gap-4">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            aria-label="Cambiar tema"
            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 transition-colors"
          >
            {theme === "dark" ? (
              /* Sun icon */
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
              </svg>
            ) : (
              /* Moon icon */
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setPasswordModal(true)}
            className="flex flex-col items-end hover:underline underline-offset-2 transition-colors"
          >
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 leading-tight">{user?.nombre}</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 leading-tight">{user?.role_nombre}</span>
          </button>
          <button
            onClick={logout}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Hamburger button — only on small screens */}
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menú"
          className="lg:hidden rounded-md p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Side menu */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-zinc-800 shadow-xl flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <span className="text-base font-semibold text-zinc-800 dark:text-zinc-50">Menú</span>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User info */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Sesión iniciada como</p>
          <button
            onClick={() => { setSidebarOpen(false); setPasswordModal(true); }}
            className="flex flex-col items-start mt-0.5 hover:underline underline-offset-2 transition-colors text-left"
          >
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100 leading-tight">{user?.nombre}</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 leading-tight">{user?.role_nombre}</span>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                pathname.startsWith(href)
                  ? "bg-zinc-800 text-white dark:bg-zinc-600"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {label}
            </Link>
          ))}
          {/* Sucursal selector */}
          {sucursales.length > 1 && (
            <div className="pt-2">
              <p className="px-4 pb-1 text-xs text-zinc-400 dark:text-zinc-500">Sucursal</p>
              <select
                value={selectedId}
                onChange={(e) => { setSidebarOpen(false); setSelected(Number(e.target.value)); }}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
              >
                {sucursales.map((s) => (
                  <option key={s.id_sucursal} value={s.id_sucursal}>
                    {s.nombre}{s.ciudad ? ` — ${s.ciudad}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Cambiar tema"
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 p-2.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 transition-colors shrink-0"
          >
            {theme === "dark" ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
              </svg>
            )}
          </button>
          <button
            onClick={logout}
            className="flex-1 rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {passwordModal && <CambiarPasswordModal onClose={() => setPasswordModal(false)} />}
    </>
  );
}
