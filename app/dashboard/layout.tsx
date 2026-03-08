"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const NAV_LINKS = [
  { href: "/dashboard/pacientes", label: "Pacientes" },
  { href: "/dashboard/usuarios",  label: "Usuarios"  },
  { href: "/dashboard/citas",     label: "Citas"     },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <nav className="flex items-center justify-between px-6 py-4 bg-white shadow-sm dark:bg-zinc-800">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-xl font-bold text-zinc-800 dark:text-zinc-50 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
            Centro podológico
          </Link>
          <div className="flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => (
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
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {user?.nombre}
          </span>
          <button
            onClick={logout}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
          >
            Cerrar sesión
          </button>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
