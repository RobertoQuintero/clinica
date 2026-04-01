"use client";

import { IRole } from "@/interfaces/roles";
import { ISucursal } from "@/interfaces/sucursal";
import { IUser } from "@/interfaces/user";

interface Props {
  usuario: IUser;
  roles: IRole[];
  sucursales: ISucursal[];
  onEdit: (u: IUser) => void;
}

export default function UsuarioFila({ usuario: u, roles, sucursales, onEdit }: Props) {
  const roleName = (id: number) => roles.find((r) => r.id_role === id)?.nombre ?? id;
  const sucursalName = (id: number) => {
    const s = sucursales.find((s) => s.id_sucursal === id);
    return s ? `${s.nombre} — ${s.ciudad}` : id;
  };

  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{u.nombre}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{u.email}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{u.telefono}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{roleName(u.id_role)}</td>
      <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">{sucursalName(u.id_sucursal)}</td>
      <td className="px-4 py-3">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${u.status ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"}`}>
          {u.status ? "Sí" : "No"}
        </span>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onEdit(u)}
          className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition-colors"
        >
          Editar
        </button>
      </td>
    </tr>
  );
}
