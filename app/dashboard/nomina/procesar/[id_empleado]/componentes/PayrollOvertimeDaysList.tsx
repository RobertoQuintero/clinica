import { Clock } from "lucide-react";
import type { IPayrollOvertimeDay } from "@/interfaces/payroll_overtime";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { formatPeriodDate } from "@/lib/payroll/periodFormat";

interface Props {
  overtimeDays: IPayrollOvertimeDay[];
}

/** Horas con un decimal como máximo (decimal(4,1) en BD), sin ceros de más: 9 -> "9", 2.5 -> "2.5". */
function formatHours(hours: number): string {
  return `${Math.round(hours * 10) / 10} h`;
}

/** Horas de una columna de reparto; "—" si el día no tiene horas de ese tipo. */
function formatHoursOrDash(hours: number): string {
  return hours > 0 ? formatHours(hours) : "—";
}

/** Importe del día: los dos importes ya redondeados, sumados en centavos. */
function sumAmounts(doubleAmount: number, tripleAmount: number): number {
  return Math.round((doubleAmount + tripleAmount) * 100) / 100;
}

export default function PayrollOvertimeDaysList({ overtimeDays }: Props) {
  if (overtimeDays.length === 0) return null;

  const totalAuthorizedHours = overtimeDays.reduce((sum, overtimeDay) => sum + overtimeDay.horas_autorizadas, 0);
  const totalDoubleHours = overtimeDays.reduce((sum, overtimeDay) => sum + overtimeDay.horas_dobles, 0);
  const totalTripleHours = overtimeDays.reduce((sum, overtimeDay) => sum + overtimeDay.horas_triples, 0);
  const totalAmount = sumAmounts(
    overtimeDays.reduce((sum, overtimeDay) => sum + overtimeDay.importe_dobles, 0),
    overtimeDays.reduce((sum, overtimeDay) => sum + overtimeDay.importe_triples, 0),
  );

  return (
    <section
      aria-labelledby="payroll-overtime-days-title"
      className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden"
    >
      <header className="px-5 py-4 bg-[#f8f9ff] dark:bg-zinc-800/60 border-b border-[#e5e8f0] dark:border-zinc-700 flex items-center gap-3">
        <span className="w-9 h-9 rounded-lg bg-[#dce9ff] dark:bg-zinc-800 text-[#0051d5] dark:text-blue-300 flex items-center justify-center">
          <Clock size={18} aria-hidden />
        </span>
        <div className="flex flex-col">
          <h3 id="payroll-overtime-days-title" className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">
            Horas extra pagadas en este periodo
          </h3>
          <span className="text-xs text-[#44474f] dark:text-zinc-400">
            {overtimeDays.length} {overtimeDays.length === 1 ? "día" : "días"} · {formatHours(totalAuthorizedHours)}{" "}
            autorizadas
          </span>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">Horas extra pagadas por día, repartidas entre dobles y triples</caption>
          <thead className="text-[11px] uppercase tracking-wider text-[#44474f] dark:text-zinc-400 border-b border-[#e5e8f0] dark:border-zinc-800">
            <tr>
              <th scope="col" className="px-5 py-2.5 font-semibold">Fecha</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-right">Autorizadas</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-right">Dobles</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-right">Triples</th>
              <th scope="col" className="px-5 py-2.5 font-semibold text-right">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e8f0] dark:divide-zinc-800">
            {overtimeDays.map((overtimeDay) => (
              <tr key={overtimeDay.fecha}>
                <td className="px-5 py-3 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 whitespace-nowrap">
                  {formatPeriodDate(overtimeDay.fecha)}
                </td>
                <td className="px-4 py-3 text-sm text-right tabular-nums text-[#0b1c30] dark:text-zinc-200">
                  {formatHours(overtimeDay.horas_autorizadas)}
                </td>
                <td className="px-4 py-3 text-sm text-right tabular-nums text-[#44474f] dark:text-zinc-300">
                  {formatHoursOrDash(overtimeDay.horas_dobles)}
                </td>
                <td className="px-4 py-3 text-sm text-right tabular-nums text-[#44474f] dark:text-zinc-300">
                  {formatHoursOrDash(overtimeDay.horas_triples)}
                </td>
                <td className="px-5 py-3 text-sm text-right font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-50">
                  {formatPayrollCurrency(sumAmounts(overtimeDay.importe_dobles, overtimeDay.importe_triples))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#dce9ff]/70 dark:bg-zinc-800 border-t-2 border-[#d3e4fe] dark:border-zinc-700">
              <th scope="row" className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#0b1c30] dark:text-zinc-100">
                Total
              </th>
              <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100">
                {formatHours(totalAuthorizedHours)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100">
                {formatHoursOrDash(totalDoubleHours)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100">
                {formatHoursOrDash(totalTripleHours)}
              </td>
              <td className="px-5 py-3 text-right text-sm font-bold tabular-nums text-[#0051d5] dark:text-blue-300">
                {formatPayrollCurrency(totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
