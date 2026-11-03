import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { IPayrollMissingEmployee, PayrollType } from "@/interfaces/payroll_calculation";
import { PAYROLL_TYPE } from "@/lib/payroll/constants";

interface Props {
  missingEmployees: IPayrollMissingEmployee[];
}

/**
 * Aviso doce (spec 96): empleado elegible hoy que no entró al cálculo guardado (contratado, reactivado,
 * transferido o con frecuencia capturada después de calcular). A diferencia de `ExcludedEmployeesNotice`,
 * no le falta un dato: falta recalcular. Vive también en estatus 3, a diferencia de los otros once avisos.
 */
export default function MissingEmployeesNotice({ missingEmployees }: Props) {
  if (missingEmployees.length === 0) return null;

  const groups = (["O", "F"] as PayrollType[])
    .map((tipo) => ({ tipo, employees: missingEmployees.filter((employee) => employee.tipo_nomina === tipo) }))
    .filter((group) => group.employees.length > 0);

  return (
    <section
      aria-label="Empleados elegibles fuera del cálculo"
      className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex gap-3"
    >
      <TriangleAlert size={20} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
      <div className="min-w-0 flex flex-col gap-3">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {missingEmployees.length === 1
            ? "1 empleado elegible no entró al cálculo guardado"
            : `${missingEmployees.length} empleados elegibles no entraron al cálculo guardado`}
        </p>
        {groups.map((group) => (
          <div key={group.tipo}>
            <p className="text-sm text-amber-800 dark:text-amber-300/90">
              Nómina {PAYROLL_TYPE[group.tipo].label.toLowerCase()}: recalcula la nómina para incluirlos.
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {group.employees.map((employee) => (
                <li key={employee.id_empleado}>
                  <Link
                    href={`/dashboard/empleados/${employee.id_empleado}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 dark:border-amber-700 bg-white/70 dark:bg-zinc-900/40 px-2.5 py-1 text-xs font-medium text-amber-900 dark:text-amber-200 hover:bg-white dark:hover:bg-zinc-900 transition-colors"
                  >
                    {employee.nombre_completo}
                    <span className="text-amber-700/80 dark:text-amber-400/80">{employee.codigo_empleado}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
