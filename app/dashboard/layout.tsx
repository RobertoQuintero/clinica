"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";

const ALL_NAV_LINKS = [
  { href: "/dashboard/pacientes",  label: "Pacientes",  minRole: 0 },
  { href: "/dashboard/usuarios",   label: "Usuarios",   minRole: 1 },
  { href: "/dashboard/citas",      label: "Citas",      minRole: 0 },
  { href: "/dashboard/servicios",  label: "Servicios",  minRole: 0 },
  { href: "/dashboard/productos",  label: "Productos",  minRole: 0 },
  { href: "/dashboard/sucursales", label: "Sucursales", minRole: 0 },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navLinks = ALL_NAV_LINKS.filter(
    (l) => l.minRole === 0 || (user?.id_role ?? 0) === l.minRole
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-white shadow-sm dark:bg-zinc-800">
        {/* Logo */}
        <Link href="/dashboard" className="text-xl font-bold text-zinc-800 dark:text-zinc-50 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
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
        </div>

        {/* User + logout — only on large screens */}
        <div className="hidden lg:flex items-center gap-4">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{user?.nombre}</span>
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
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User info */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Sesión iniciada como</p>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 mt-0.5">{user?.nombre}</p>
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
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-zinc-200 dark:border-zinc-700">
          <button
            onClick={logout}
            className="w-full rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="p-6">{children}</main>
    </div>
  );
}
