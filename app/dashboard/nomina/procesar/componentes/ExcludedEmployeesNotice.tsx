import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { IPayrollExcludedEmployee, PayrollType } from "@/interfaces/payroll_calculation";
import { PAYROLL_TYPE } from "@/lib/payroll/constants";

interface Props {
  excludedEmployees: IPayrollExcludedEmployee[];
  payrollType: PayrollType;
}

const MISSING_SALARY_LABEL: Record<PayrollType, string> = {
  O: "salario diario",
  F: "salario diario fiscal",
};

export default function ExcludedEmployeesNotice({ excludedEmployees, payrollType }: Props) {
  if (excludedEmployees.length === 0) return null;

  return (
    <section
      aria-label="Empleados sin salario capturado"
      className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex gap-3"
    >
      <TriangleAlert size={20} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {excludedEmployees.length === 1
            ? `1 empleado no entra a la nómina ${PAYROLL_TYPE[payrollType].label.toLowerCase()}`
            : `${excludedEmployees.length} empleados no entran a la nómina ${PAYROLL_TYPE[payrollType].label.toLowerCase()}`}
        </p>
        <p className="text-sm text-amber-800 dark:text-amber-300/90 mt-0.5">
          Les falta el {MISSING_SALARY_LABEL[payrollType]}. Captúralo en su ficha y recalcula la nómina.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {excludedEmployees.map((employee) => (
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
    </section>
  );
}
