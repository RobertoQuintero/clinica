import { Users, UserCheck } from "lucide-react";
import { IEmployeeListItem } from "@/interfaces/employee";

interface Props {
  employees: IEmployeeListItem[];
}

/** Tarjetas Total / Activos, calculadas del mismo arreglo ya cargado por el Server Component. */
export default function EmployeeSummaryCards({ employees }: Props) {
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((employee) => employee.activo).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-4 flex items-center gap-4 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-[#0051d5]/10 dark:bg-blue-900/30 flex items-center justify-center text-[#0051d5] dark:text-blue-400">
          <Users size={20} />
        </div>
        <div>
          <p className="text-xs font-medium text-[#44474f] dark:text-zinc-400">Total de Empleados</p>
          <p className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">{totalEmployees}</p>
        </div>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-4 flex items-center gap-4 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-[#009c6b]/10 dark:bg-emerald-900/30 flex items-center justify-center text-[#009c6b] dark:text-emerald-400">
          <UserCheck size={20} />
        </div>
        <div>
          <p className="text-xs font-medium text-[#44474f] dark:text-zinc-400">Empleados Activos</p>
          <p className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">{activeEmployees}</p>
        </div>
      </div>
    </div>
  );
}
