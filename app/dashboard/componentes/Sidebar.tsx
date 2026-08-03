"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useSucursal } from "@/contexts/SucursalContext";
import { useTheme } from "@/contexts/ThemeContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Sun, Moon, LogOut, Menu, X, ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import CambiarPasswordModal from "@/app/dashboard/componentes/CambiarPasswordModal";
import { NAV_LINKS, type NavLink } from "@/app/dashboard/componentes/navConfig";

const RAIL_WIDTH = 72;
const EXPANDED_WIDTH = 240;
const COLLAPSED_STORAGE_KEY = "sidebar_collapsed";

export default function Sidebar({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { sucursales, selectedId, setSelected } = useSucursal();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (stored !== null) setCollapsed(stored === "true");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  };

  const links = NAV_LINKS.filter(
    (l) =>
      (l.minRole === 0 || (user?.id_role ?? 0) === l.minRole) &&
      !l.excludeRoles.includes(user?.id_role ?? 0)
  );

  const asideWidth = collapsed ? RAIL_WIDTH : EXPANDED_WIDTH;
  const isActive = (href?: string) => !!href && pathname.startsWith(href);
  const isGroupActive = (link: NavLink) => !!link.children?.some((c) => pathname.startsWith(c.href));

  const renderLink = (link: NavLink) => {
    const Icon = link.icon;

    if (link.children) {
      const active = isGroupActive(link);
      return (
        <div key={link.label} className="relative group">
          <div
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-zinc-700 text-white" : "text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1">{link.label}</span>
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </div>
          <div
            className={
              collapsed
                ? "invisible absolute left-full top-0 z-50 ml-2 min-w-[180px] rounded-md bg-zinc-800 py-2 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100"
                : "pl-8 space-y-1"
            }
          >
            {collapsed && (
              <p className="px-3 pb-1 text-xs font-semibold text-zinc-400">{link.label}</p>
            )}
            {link.children.map((child) => {
              const ChildIcon = child.icon;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    collapsed ? "" : "rounded-md"
                  } ${
                    pathname.startsWith(child.href)
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  <ChildIcon className="h-4 w-4" />
                  {child.label}
                </Link>
              );
            })}
          </div>
        </div>
      );
    }

    if (link.disabled) {
      return (
        <div
          key={link.label}
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-zinc-500 opacity-50 cursor-not-allowed"
        >
          <Icon className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{link.label}</span>}
        </div>
      );
    }

    return (
      <Link
        key={link.href}
        href={link.href!}
        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive(link.href) ? "bg-zinc-700 text-white" : "text-zinc-300 hover:bg-zinc-800"
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span>{link.label}</span>}
      </Link>
    );
  };

  return (
    <>
      {/* Desktop / tablet aside */}
      <aside
        style={{ width: asideWidth }}
        className="hidden lg:flex fixed top-0 left-0 z-40 h-screen flex-col bg-zinc-900 text-white transition-all duration-300"
      >
        <div className="flex items-center justify-between px-4 py-5">
          {!collapsed && <span className="text-lg font-bold">Pie Zen</span>}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">{links.map(renderLink)}</nav>
      </aside>

      {/* Header + content wrapper */}
      <div
        style={{ "--sidebar-w": `${asideWidth}px` } as CSSProperties}
        className="flex min-h-screen flex-col lg:ml-[var(--sidebar-w)] transition-all duration-300"
      >
        {/* Desktop header */}
        <header className="hidden lg:flex sticky top-0 z-30 items-center justify-end gap-4 bg-white px-6 py-3 shadow-sm dark:bg-zinc-800">
          {sucursales.length > 1 && (
            <select
              value={selectedId}
              onChange={(e) => setSelected(Number(e.target.value))}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 shadow-sm transition-colors hover:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
            >
              {sucursales.map((s) => (
                <option key={s.id_sucursal} value={s.id_sucursal}>
                  {s.nombre}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={toggle}
            aria-label="Cambiar tema"
            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 transition-colors"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
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
            className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </header>

        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-white px-4 py-3 shadow-sm dark:bg-zinc-800">
          <Link href="/dashboard" className="text-lg font-bold text-zinc-800 dark:text-zinc-50">
            Pie Zen
          </Link>
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1">{children}</main>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-zinc-800 shadow-xl flex flex-col transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <span className="text-base font-semibold text-zinc-800 dark:text-zinc-50">Menú</span>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Sesión iniciada como</p>
          <button
            onClick={() => {
              setMobileOpen(false);
              setPasswordModal(true);
            }}
            className="flex flex-col items-start mt-0.5 hover:underline underline-offset-2 transition-colors text-left"
          >
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100 leading-tight">{user?.nombre}</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 leading-tight">{user?.role_nombre}</span>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;

            if (link.children) {
              const active = isGroupActive(link);
              return (
                <div key={link.label}>
                  <div
                    className={`flex items-center gap-3 rounded-md px-4 py-2.5 text-sm font-medium ${
                      active ? "bg-zinc-800 text-white dark:bg-zinc-600" : "text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{link.label}</span>
                  </div>
                  <div className="pl-9 space-y-1">
                    {link.children.map((child) => {
                      const ChildIcon = child.icon;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors ${
                            pathname.startsWith(child.href)
                              ? "bg-zinc-800 text-white dark:bg-zinc-600"
                              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          }`}
                        >
                          <ChildIcon className="h-4 w-4" />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (link.disabled) {
              return (
                <div
                  key={link.label}
                  className="flex items-center gap-3 rounded-md px-4 py-2.5 text-sm font-medium text-zinc-400 opacity-50 cursor-not-allowed dark:text-zinc-500"
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{link.label}</span>
                </div>
              );
            }

            return (
              <Link
                key={link.href}
                href={link.href!}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-zinc-800 text-white dark:bg-zinc-600"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {link.label}
              </Link>
            );
          })}

          {sucursales.length > 1 && (
            <div className="pt-2">
              <p className="px-4 pb-1 text-xs text-zinc-400 dark:text-zinc-500">Sucursal</p>
              <select
                value={selectedId}
                onChange={(e) => {
                  setMobileOpen(false);
                  setSelected(Number(e.target.value));
                }}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
              >
                {sucursales.map((s) => (
                  <option key={s.id_sucursal} value={s.id_sucursal}>
                    {s.nombre}
                    {s.ciudad ? ` — ${s.ciudad}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Cambiar tema"
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 p-2.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 transition-colors shrink-0"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            onClick={logout}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {passwordModal && <CambiarPasswordModal onClose={() => setPasswordModal(false)} />}
    </>
  );
}
