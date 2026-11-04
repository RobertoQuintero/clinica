import { CalendarClock } from "lucide-react";
import type { IPayrollPendingDayRow } from "@/interfaces/payroll_pending_days";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { formatPeriodDate } from "@/lib/payroll/periodFormat";

interface Props {
  pendingDays: IPayrollPendingDayRow[];
}

/** Lista del Detalle: días pendientes de pago ya pagados en este renglón. Oculta sin días pagados. */
export default function PayrollPendingDaysList({ pendingDays }: Props) {
  if (pendingDays.length === 0) return null;

  const totalAmount = Math.round(pendingDays.reduce((sum, day) => sum + day.importe, 0) * 100) / 100;

  return (
    <section
      aria-labelledby="payroll-pending-days-title"
      className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden"
    >
      <header className="px-5 py-4 bg-[#f8f9ff] dark:bg-zinc-800/60 border-b border-[#e5e8f0] dark:border-zinc-700 flex items-center gap-3">
        <span className="w-9 h-9 rounded-lg bg-[#dce9ff] dark:bg-zinc-800 text-[#0051d5] dark:text-blue-300 flex items-center justify-center">
          <CalendarClock size={18} aria-hidden />
        </span>
        <div className="flex flex-col">
          <h3 id="payroll-pending-days-title" className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">
            Días pendientes de pago en este periodo
          </h3>
          <span className="text-xs text-[#44474f] dark:text-zinc-400">
            {pendingDays.length} {pendingDays.length === 1 ? "día" : "días"}
          </span>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">Días pendientes de pago pagados, con su tarifa, importe y motivo</caption>
          <thead className="text-[11px] uppercase tracking-wider text-[#44474f] dark:text-zinc-400 border-b border-[#e5e8f0] dark:border-zinc-800">
            <tr>
              <th scope="col" className="px-5 py-2.5 font-semibold">Fecha</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-right">Tarifa</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-right">Importe</th>
              <th scope="col" className="px-5 py-2.5 font-semibold">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e8f0] dark:divide-zinc-800">
            {pendingDays.map((day) => (
              <tr key={day.fecha}>
                <td className="px-5 py-3 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 whitespace-nowrap">
                  {formatPeriodDate(day.fecha)}
                </td>
                <td className="px-4 py-3 text-sm text-right tabular-nums text-[#44474f] dark:text-zinc-300">
                  {formatPayrollCurrency(day.tarifa_diaria)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-50">
                  {formatPayrollCurrency(day.importe)}
                </td>
                <td className="px-5 py-3 text-sm text-[#44474f] dark:text-zinc-300 max-w-80">
                  <span className="block line-clamp-2">{day.motivo}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#dce9ff]/70 dark:bg-zinc-800 border-t-2 border-[#d3e4fe] dark:border-zinc-700">
              <th scope="row" className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#0b1c30] dark:text-zinc-100">
                Total
              </th>
              <td />
              <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-[#0051d5] dark:text-blue-300">
                {formatPayrollCurrency(totalAmount)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
