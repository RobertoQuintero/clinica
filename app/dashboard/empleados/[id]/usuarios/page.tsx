import { notFound } from "next/navigation";
import { getEmployeeLinkedUsers, getLinkableUsers } from "./actions";
import LinkedUsersTable from "./componentes/LinkedUsersTable";
import LinkUserModal from "./componentes/LinkUserModal";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EmployeeUsersPage({ params }: Props) {
  const { id } = await params;
  const id_empleado = Number(id);
  if (!Number.isInteger(id_empleado) || id_empleado <= 0) notFound();

  const [linkedUsers, linkableUsers] = await Promise.all([
    getEmployeeLinkedUsers(id_empleado),
    getLinkableUsers(id_empleado),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">Usuarios</h2>
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            Cuentas del sistema que pertenecen a este empleado.
          </p>
        </div>
        <LinkUserModal id_empleado={id_empleado} linkableUsers={linkableUsers} />
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-[#c4c6d0] dark:border-zinc-700 flex items-center gap-3">
          <h3 className="text-lg font-bold text-[#0b1c30] dark:text-zinc-50">Usuarios vinculados</h3>
          <span className="px-2 py-0.5 rounded-full bg-[#dbe1ff] dark:bg-blue-900/30 text-[#0043b0] dark:text-blue-400 text-xs font-semibold">
            {linkedUsers.length}
          </span>
        </div>
        <LinkedUsersTable id_empleado={id_empleado} linkedUsers={linkedUsers} />
      </div>
    </div>
  );
}
