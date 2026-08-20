import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import { IEmployeeListItem } from "@/interfaces/employee";
import { dayFirst } from "@/utils/date_helpper";
import EmployeeStatusBadge from "./EmployeeStatusBadge";

interface Props {
  employee: IEmployeeListItem;
  onEdit: (employee: IEmployeeListItem) => void;
}

export default function EmployeeRow({ employee, onEdit }: Props) {
  const rowOpacity = employee.activo ? "" : "opacity-60";

  return (
    <tr className="hover:bg-[#eff4ff] dark:hover:bg-zinc-800/60 transition-colors group">
      <td className={`px-6 py-4 ${rowOpacity}`}>
        <div className="flex flex-col">
          <span className="font-medium text-[#0b1c30] dark:text-zinc-100">
            {employee.nombre_completo}
          </span>
          <span className="text-xs text-[#44474f] dark:text-zinc-400">{employee.codigo_empleado}</span>
        </div>
      </td>
      <td className={`px-6 py-4 text-[#44474f] dark:text-zinc-400 ${rowOpacity}`}>
        {employee.whatsapp || "—"}
      </td>
      <td className={`px-6 py-4 ${rowOpacity}`}>
        <div className="flex flex-col">
          <span className="text-[#0b1c30] dark:text-zinc-100">{employee.nombre_puesto}</span>
          <span className="text-xs text-[#44474f] dark:text-zinc-400">{employee.nombre_departamento}</span>
        </div>
      </td>
      <td className={`px-6 py-4 text-[#0b1c30] dark:text-zinc-100 ${rowOpacity}`}>
        {employee.nombre_sucursal}
      </td>
      <td className={`px-6 py-4 text-[#44474f] dark:text-zinc-400 ${rowOpacity}`}>
        {dayFirst(employee.fecha_ingreso + "T00:00:00")}
      </td>
      <td className="px-6 py-4">
        <EmployeeStatusBadge activo={employee.activo} />
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link
            href={`/dashboard/empleados/${employee.id_empleado}`}
            title="Ver expediente"
            className="text-[#44474f] dark:text-zinc-400 hover:text-[#0051d5] dark:hover:text-blue-400 p-1.5 rounded-md hover:bg-[#eff4ff] dark:hover:bg-zinc-700 transition-colors"
          >
            <Eye size={16} />
          </Link>
          <button
            type="button"
            onClick={() => onEdit(employee)}
            title="Editar"
            className="text-[#44474f] dark:text-zinc-400 hover:text-[#0051d5] dark:hover:text-blue-400 p-1.5 rounded-md hover:bg-[#eff4ff] dark:hover:bg-zinc-700 transition-colors"
          >
            <Pencil size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}
