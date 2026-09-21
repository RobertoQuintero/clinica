import type { IPayrollEmployeeRow, PayrollType } from "@/interfaces/payroll_calculation";
import { PAYROLL_TYPE } from "@/lib/payroll/constants";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

interface Props {
  rows: IPayrollEmployeeRow[];
  payrollType: PayrollType;
  /** Totales de todo el tipo: no cambian con los filtros de puesto y búsqueda. */
  totals: { employees: number; importeSalario: number };
  hasActiveFilters: boolean;
}

export default function PayrollEmployeesTable({ rows, payrollType, totals, hasActiveFilters }: Props) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">Sueldos de la nómina {PAYROLL_TYPE[payrollType].label.toLowerCase()}</caption>
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold">Empleado</th>
              <th scope="col" className="px-4 py-3 font-semibold">Puesto</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Salario D.</th>
              <th scope="col" className="px-4 py-3 font-semibold text-center">Días</th>
              <th scope="col" className="px-6 py-3 font-semibold text-right">Sueldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-[#747780] dark:text-zinc-500">
                  {hasActiveFilters
                    ? "Ningún empleado coincide con los filtros."
                    : "Ningún empleado tiene sueldo calculado en esta nómina."}
                </td>
              </tr>
            ) : (
              rows.map((employeeRow) => (
                <tr
                  key={employeeRow.id_period_employee}
                  className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-6 py-3.5">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 truncate">
                        {employeeRow.nombre_completo}
                      </span>
                      <span className="text-[11px] text-[#747780] dark:text-zinc-500">
                        {employeeRow.codigo_empleado}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[#44474f] dark:text-zinc-300 whitespace-nowrap">
                    {employeeRow.nombre_puesto}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-right tabular-nums text-[#0b1c30] dark:text-zinc-200">
                    {formatPayrollCurrency(employeeRow.salario_diario)}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-block min-w-9 px-2 py-0.5 rounded bg-[#e6eeff] dark:bg-zinc-800 text-xs font-medium text-[#44474f] dark:text-zinc-300 tabular-nums">
                      {employeeRow.dias} d
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-sm text-right font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-50">
                    {formatPayrollCurrency(employeeRow.importe_salario)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-[#dce9ff]/70 dark:bg-zinc-800 border-t-2 border-[#d3e4fe] dark:border-zinc-700">
              <th
                scope="row"
                colSpan={4}
                className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#0b1c30] dark:text-zinc-100"
              >
                Total nómina {PAYROLL_TYPE[payrollType].label.toLowerCase()}
                <span className="ml-2 font-medium normal-case tracking-normal text-[#44474f] dark:text-zinc-400">
                  {totals.employees} {totals.employees === 1 ? "empleado" : "empleados"}
                  {hasActiveFilters && ` · mostrando ${rows.length}`}
                </span>
              </th>
              <td className="px-6 py-4 text-right text-base font-bold tabular-nums text-[#0051d5] dark:text-blue-300">
                {formatPayrollCurrency(totals.importeSalario)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
