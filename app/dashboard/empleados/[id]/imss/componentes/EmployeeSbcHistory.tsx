import type { ReactNode } from "react";
import type { IEmployeeSbc } from "@/interfaces/employee_sbc";
import { formatPayrollCurrency, formatDateTimeSlashed } from "@/lib/payroll/moneyFormat";
import { formatPeriodDate } from "@/lib/payroll/periodFormat";

interface Props {
  history: IEmployeeSbc[];
  /** SBC vigente hoy: se marca en la tabla. */
  currentIdEmployeeSbc: number | null;
  /** Acciones (editar y eliminar) de una fila; se omiten con el empleado inactivo. */
  renderRowActions?: (employeeSbc: IEmployeeSbc) => ReactNode;
}

export default function EmployeeSbcHistory({ history, currentIdEmployeeSbc, renderRowActions }: Props) {
  return (
    <section
      aria-label="Historial del SBC"
      className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm"
    >
      <h3 className="px-5 py-4 text-lg font-bold text-[#0b1c30] dark:text-zinc-50 border-b border-[#c4c6d0] dark:border-zinc-700">
        Historial
      </h3>
      {history.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-[#74777f] dark:text-zinc-500">
          Sin SBC capturado. Mientras no haya uno, el IMSS queda &ldquo;No calculado&rdquo; en la nómina fiscal.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400 bg-[#eff4ff] dark:bg-zinc-800/60">
              <tr>
                <th className="px-5 py-3">Vigente desde</th>
                <th className="px-5 py-3 text-right">SBC</th>
                <th className="px-5 py-3">Capturó</th>
                <th className="px-5 py-3">Fecha de captura</th>
                {renderRowActions && <th className="px-5 py-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c4c6d0] dark:divide-zinc-700">
              {history.map((employeeSbc) => (
                <tr key={employeeSbc.id_employee_sbc}>
                  <td className="px-5 py-3 tabular-nums text-[#0b1c30] dark:text-zinc-100">
                    {formatPeriodDate(employeeSbc.vigente_desde)}
                    {employeeSbc.id_employee_sbc === currentIdEmployeeSbc && (
                      <span className="ml-2 rounded-full bg-[#0051d5]/10 px-2 py-0.5 text-xs font-semibold text-[#0051d5] dark:text-blue-400">
                        Vigente
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium text-[#0b1c30] dark:text-zinc-100">
                    {formatPayrollCurrency(employeeSbc.sbc)}
                  </td>
                  <td className="px-5 py-3 text-[#44474f] dark:text-zinc-400">{employeeSbc.updated_by_name}</td>
                  <td className="px-5 py-3 tabular-nums text-[#44474f] dark:text-zinc-400">
                    {formatDateTimeSlashed(employeeSbc.updated_at)}
                  </td>
                  {renderRowActions && (
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">{renderRowActions(employeeSbc)}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
