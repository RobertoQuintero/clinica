import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { IOvertimePage } from "@/interfaces/payroll_overtime";

interface Props {
  employees: IOvertimePage["employeesWithoutSchedule"];
}

export default function EmployeesWithoutScheduleNotice({ employees }: Props) {
  if (employees.length === 0) return null;

  return (
    <section
      aria-label="Empleados sin horario definido"
      className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex gap-3"
    >
      <TriangleAlert size={20} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {employees.length === 1
            ? "1 empleado sin horario definido"
            : `${employees.length} empleados sin horario definido`}
        </p>
        <p className="text-sm text-amber-800 dark:text-amber-300/90 mt-0.5">
          Sin horario no se pueden detectar sus horas extra. Captúralo en la pestaña Horario de su ficha.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {employees.map((employee) => (
            <li key={employee.id_empleado}>
              <Link
                href={`/dashboard/empleados/${employee.id_empleado}/horario`}
                className="inline-flex items-center rounded-full border border-amber-300 dark:border-amber-700 bg-white/70 dark:bg-zinc-900/40 px-2.5 py-1 text-xs font-medium text-amber-900 dark:text-amber-200 hover:bg-white dark:hover:bg-zinc-900 transition-colors"
              >
                {employee.nombre_completo}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
