import Link from "next/link";
import { Info } from "lucide-react";
import type { IPayrollMissingEmployee, PayrollType } from "@/interfaces/payroll_calculation";
import { PAYROLL_TYPE } from "@/lib/payroll/constants";

interface Props {
  notCovered: IPayrollMissingEmployee[];
}

/**
 * Aviso "capturas que no se pagarán" (spec 97): empleado con una captura de días pendientes de este periodo
 * sin fila de ese tipo en `period_employees`. No bloquea nada; se corrige capturando el salario del tipo y
 * recalculando. Misma forma que `MissingEmployeesNotice` (spec 96), en azul porque no hay nada roto que arreglar
 * con urgencia: es información, no una advertencia de recálculo.
 */
export default function PendingDaysNotCoveredNotice({ notCovered }: Props) {
  if (notCovered.length === 0) return null;

  const groups = (["O", "F"] as PayrollType[])
    .map((tipo) => ({ tipo, employees: notCovered.filter((employee) => employee.tipo_nomina === tipo) }))
    .filter((group) => group.employees.length > 0);

  return (
    <section
      aria-label="Días pendientes que no se pagarán"
      className="rounded-xl border border-[#0051d5]/20 bg-[#0051d5]/5 dark:border-blue-800 dark:bg-blue-900/20 p-4 flex gap-3"
    >
      <Info size={20} className="shrink-0 mt-0.5 text-[#0051d5] dark:text-blue-300" aria-hidden />
      <div className="min-w-0 flex flex-col gap-3">
        <p className="text-sm font-semibold text-[#00174b] dark:text-blue-200">
          {notCovered.length === 1
            ? "1 día pendiente capturado no se pagará en este cálculo"
            : `${notCovered.length} días pendientes capturados no se pagarán en este cálculo`}
        </p>
        {groups.map((group) => (
          <div key={group.tipo}>
            <p className="text-sm text-[#00174b]/90 dark:text-blue-200/90">
              Nómina {PAYROLL_TYPE[group.tipo].label.toLowerCase()}: captura el salario del empleado y recalcula para pagarlo.
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {group.employees.map((employee) => (
                <li key={employee.id_empleado}>
                  <Link
                    href={`/dashboard/empleados/${employee.id_empleado}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#0051d5]/30 dark:border-blue-700 bg-white/70 dark:bg-zinc-900/40 px-2.5 py-1 text-xs font-medium text-[#00174b] dark:text-blue-200 hover:bg-white dark:hover:bg-zinc-900 transition-colors"
                  >
                    {employee.nombre_completo}
                    <span className="text-[#0051d5]/80 dark:text-blue-400/80">{employee.codigo_empleado}</span>
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
