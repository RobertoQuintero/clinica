import { ArrowRight, ChevronDown } from "lucide-react";
import { PAYROLL_PERIOD_STATUS } from "@/lib/payroll/constants";
import { formatDateTimeSlashed } from "@/lib/payroll/moneyFormat";
import { getPayrollPeriodStatusLog } from "../actions";

interface Props {
  idPeriod: number;
}

/** Plegable "Historial de estatus": una fila por aprobación, pago o desaprobación, más reciente primero. */
export default async function PayrollPeriodStatusLog({ idPeriod }: Props) {
  const result = await getPayrollPeriodStatusLog(idPeriod);
  const entries = result.ok ? result.data : [];
  if (entries.length === 0) return null;

  return (
    <details
      data-manual-capture="payroll-status-log"
      className="group bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-3.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-50 hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors [&::-webkit-details-marker]:hidden">
        <span>
          Historial de estatus
          <span className="ml-2 font-normal text-[#44474f] dark:text-zinc-400">{entries.length} cambio(s)</span>
        </span>
        <ChevronDown size={18} aria-hidden className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="overflow-x-auto border-t border-[#c4c6d0] dark:border-zinc-700">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold">Fecha</th>
              <th scope="col" className="px-6 py-3 font-semibold">Autor</th>
              <th scope="col" className="px-6 py-3 font-semibold">Cambio</th>
              <th scope="col" className="px-6 py-3 font-semibold">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {entries.map((entry) => (
              <tr key={entry.id_period_status_log} className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors">
                <td className="px-6 py-3.5 whitespace-nowrap tabular-nums text-[#0b1c30] dark:text-zinc-100">
                  {formatDateTimeSlashed(entry.changed_at)}
                </td>
                <td className="px-6 py-3.5 text-[#0b1c30] dark:text-zinc-100">{entry.changed_by_name || "—"}</td>
                <td className="px-6 py-3.5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2 text-[#0b1c30] dark:text-zinc-100">
                    {PAYROLL_PERIOD_STATUS[entry.status_anterior].label}
                    <ArrowRight size={14} aria-hidden className="text-[#747780] dark:text-zinc-500" />
                    {PAYROLL_PERIOD_STATUS[entry.status_nuevo].label}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-[#44474f] dark:text-zinc-400">{entry.comentario ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
