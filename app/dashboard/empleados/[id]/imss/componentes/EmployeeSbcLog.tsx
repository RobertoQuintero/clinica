import type { IEmployeeSbcLogEntry } from "@/interfaces/employee_sbc";
import { EMPLOYEE_SBC_LOG_PAGE_SIZE } from "@/lib/payroll/constants";
import { formatDateTimeSlashed, formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { formatPeriodDate } from "@/lib/payroll/periodFormat";

interface Props {
  entries: IEmployeeSbcLogEntry[];
}

function describeLogChange(entry: IEmployeeSbcLogEntry): string {
  if (entry.sbc_anterior === null && entry.sbc_nuevo !== null) return `Alta: ${formatPayrollCurrency(entry.sbc_nuevo)}`;
  if (entry.sbc_nuevo === null && entry.sbc_anterior !== null) return `Baja: ${formatPayrollCurrency(entry.sbc_anterior)}`;
  if (entry.sbc_anterior !== null && entry.sbc_nuevo !== null) {
    return `${formatPayrollCurrency(entry.sbc_anterior)} → ${formatPayrollCurrency(entry.sbc_nuevo)}`;
  }
  return "";
}

/** Bitácora de cambios del SBC: las últimas 20 entradas dentro de un `<details>` (sin JS). */
export default function EmployeeSbcLog({ entries }: Props) {
  return (
    <details className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-[#0b1c30] dark:text-zinc-50">
        Bitácora de cambios (últimas {EMPLOYEE_SBC_LOG_PAGE_SIZE})
      </summary>
      {entries.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-[#74777f] dark:text-zinc-500 border-t border-[#c4c6d0] dark:border-zinc-700">
          Sin cambios registrados.
        </p>
      ) : (
        <div className="overflow-x-auto border-t border-[#c4c6d0] dark:border-zinc-700">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400 bg-[#eff4ff] dark:bg-zinc-800/60">
              <tr>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Vigente desde</th>
                <th className="px-5 py-3">Cambio</th>
                <th className="px-5 py-3">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c4c6d0] dark:divide-zinc-700">
              {entries.map((entry) => (
                <tr key={entry.id_log}>
                  <td className="px-5 py-3 tabular-nums text-[#44474f] dark:text-zinc-400">
                    {formatDateTimeSlashed(entry.updated_at)}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-[#0b1c30] dark:text-zinc-100">
                    {formatPeriodDate(entry.vigente_desde)}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-[#0b1c30] dark:text-zinc-100">{describeLogChange(entry)}</td>
                  <td className="px-5 py-3 text-[#44474f] dark:text-zinc-400">{entry.updated_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
