"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { IEmployeeUserListItem } from "@/interfaces/user";
import { linkUserToEmployee } from "../actions";

interface Props {
  id_empleado: number;
  linkableUsers: IEmployeeUserListItem[];
}

/** Botón "Vincular usuario" + modal con buscador (nombre o email) sobre los usuarios elegibles.
 *  El filtrado es en el cliente: la lista ya viene acotada por empresa desde el servidor. */
export default function LinkUserModal({ id_empleado, linkableUsers }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [linkingUserId, setLinkingUserId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  function closeModal() {
    setIsOpen(false);
    setSearchText("");
    setErrorMessage(null);
  }

  useEffect(() => {
    if (!isOpen) return;
    searchInputRef.current?.focus();
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    if (!normalizedSearch) return linkableUsers;
    return linkableUsers.filter(
      (linkableUser) =>
        linkableUser.nombre.toLowerCase().includes(normalizedSearch) ||
        linkableUser.email.toLowerCase().includes(normalizedSearch)
    );
  }, [linkableUsers, searchText]);

  async function handleLink(id_user: number) {
    setLinkingUserId(id_user);
    setErrorMessage(null);
    try {
      const result = await linkUserToEmployee({ id_empleado, id_user });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
    } finally {
      setLinkingUserId(null);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-[#0051d5] text-white text-sm font-semibold rounded-lg hover:bg-[#0043b0] transition-colors"
      >
        Vincular usuario
      </button>

      {isOpen &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeModal();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="link-user-modal-title"
              className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
                <h3 id="link-user-modal-title" className="text-lg font-bold text-[#0b1c30] dark:text-zinc-50">
                  Vincular usuario
                </h3>
                <button
                  onClick={closeModal}
                  aria-label="Cerrar"
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none"
                >
                  &times;
                </button>
              </div>

              <div className="flex flex-col gap-4 overflow-y-auto p-6">
                <p className="text-sm text-[#44474f] dark:text-zinc-400">
                  Cuentas activas de la misma empresa que todavía no pertenecen a ningún empleado.
                </p>

                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Buscar por nombre o email..."
                  aria-label="Buscar usuario por nombre o email"
                  className="w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 placeholder-zinc-400 focus:border-[#0051d5] focus:outline-none focus:ring-1 focus:ring-[#0051d5]"
                />

                {errorMessage && (
                  <div
                    role="alert"
                    className="rounded-lg border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 px-4 py-3 text-sm text-[#ba1a1a] dark:text-red-400"
                  >
                    {errorMessage}
                  </div>
                )}

                {filteredUsers.length === 0 ? (
                  <div className="bg-[#f8f9fb] dark:bg-zinc-800 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-8 text-center text-sm text-[#44474f] dark:text-zinc-400">
                    No hay usuarios disponibles para vincular
                  </div>
                ) : (
                  <ul className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden">
                    {filteredUsers.map((linkableUser) => (
                      <li
                        key={linkableUser.id_user}
                        className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[#f8f9fb] dark:hover:bg-zinc-800/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#0b1c30] dark:text-zinc-100">
                            {linkableUser.nombre}
                          </p>
                          <p className="truncate text-xs text-[#44474f] dark:text-zinc-400">
                            {linkableUser.email} · {linkableUser.nombre_role} · {linkableUser.nombre_sucursal}
                          </p>
                        </div>
                        <button
                          onClick={() => handleLink(linkableUser.id_user)}
                          disabled={linkingUserId !== null}
                          className="shrink-0 px-3 py-1.5 text-xs font-semibold text-[#0051d5] dark:text-blue-400 hover:bg-[#0051d5]/10 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {linkingUserId === linkableUser.id_user ? "Vinculando…" : "Vincular"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
                <button
                  onClick={closeModal}
                  className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-4 py-2 text-sm font-medium text-[#44474f] dark:text-zinc-300 hover:bg-[#f8f9fb] dark:hover:bg-zinc-800 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
