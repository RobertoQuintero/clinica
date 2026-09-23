import Link from "next/link";
import { IEmployeeUserListItem } from "@/interfaces/user";

interface Props {
  linkedUsers: IEmployeeUserListItem[];
}

export default function LinkedUsersTable({ linkedUsers }: Props) {
  if (linkedUsers.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-[#44474f] dark:text-zinc-400">
        Este empleado no tiene usuarios vinculados
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-[#f8f9fb] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Nombre</th>
            <th className="px-5 py-3 font-semibold">Email</th>
            <th className="px-5 py-3 font-semibold">Rol</th>
            <th className="px-5 py-3 font-semibold">Sucursal</th>
            <th className="px-5 py-3 font-semibold">Estatus</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50 text-sm">
          {linkedUsers.map((linkedUser) => (
            <tr key={linkedUser.id_user} className="hover:bg-[#f8f9fb] dark:hover:bg-zinc-800/50">
              <td className="px-5 py-3 font-medium text-[#0b1c30] dark:text-zinc-100">
                <Link href="/dashboard/usuarios" className="hover:underline">
                  {linkedUser.nombre}
                </Link>
              </td>
              <td className="px-5 py-3 text-[#44474f] dark:text-zinc-400">{linkedUser.email}</td>
              <td className="px-5 py-3 text-[#44474f] dark:text-zinc-400">{linkedUser.nombre_role}</td>
              <td className="px-5 py-3 text-[#44474f] dark:text-zinc-400">{linkedUser.nombre_sucursal}</td>
              <td className="px-5 py-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    linkedUser.status
                      ? "bg-[#d7e8da] text-[#1e6b3a] dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                  }`}
                >
                  {linkedUser.status ? "Activo" : "Inactivo"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
