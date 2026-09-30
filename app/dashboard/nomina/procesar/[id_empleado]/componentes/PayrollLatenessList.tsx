import { AlarmClockOff } from "lucide-react";
import type { IPayrollDiscountedLateness, LatenessClassification } from "@/interfaces/payroll_lateness";
import { formatPeriodDate } from "@/lib/payroll/periodFormat";

interface Props {
  discountedLateness: IPayrollDiscountedLateness[];
}

const CLASSIFICATION_LABELS: Record<LatenessClassification, string> = {
  severe: "Grave",
  accumulable: "Acumulable",
};

/** Retardos injustificados descontados del tipo de nómina seleccionado; se oculta si no hay ninguno (spec 63). */
export default function PayrollLatenessList({ discountedLateness }: Props) {
  if (discountedLateness.length === 0) return null;

  return (
    <section
      aria-labelledby="payroll-lateness-title"
      className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden"
    >
      <header className="px-5 py-4 bg-[#f8f9ff] dark:bg-zinc-800/60 border-b border-[#e5e8f0] dark:border-zinc-700 flex items-center gap-3">
        <span className="w-9 h-9 rounded-lg bg-[#dce9ff] dark:bg-zinc-800 text-[#0051d5] dark:text-blue-300 flex items-center justify-center">
          <AlarmClockOff size={18} aria-hidden />
        </span>
        <div className="flex flex-col">
          <h3 id="payroll-lateness-title" className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">
            Retardos descontados en este periodo
          </h3>
          <span className="text-xs text-[#44474f] dark:text-zinc-400">
            {discountedLateness.length} {discountedLateness.length === 1 ? "retardo" : "retardos"} del sueldo base
          </span>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">Retardos descontados</caption>
          <thead className="border-b border-[#e5e8f0] dark:border-zinc-700 text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-5 py-2.5 font-semibold">Día</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Programada</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Llegada</th>
              <th scope="col" className="px-4 py-2.5 font-semibold text-right">Minutos</th>
              <th scope="col" className="px-5 py-2.5 font-semibold">Tipo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e8f0]/70 dark:divide-zinc-700/50">
            {discountedLateness.map((lateness) => (
              <tr key={lateness.fecha}>
                <td className="px-5 py-3 text-sm font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100">
                  {formatPeriodDate(lateness.fecha)}
                </td>
                <td className="px-4 py-3 text-sm tabular-nums text-[#44474f] dark:text-zinc-300">
                  {lateness.hora_entrada_1}
                </td>
                <td className="px-4 py-3 text-sm tabular-nums text-[#44474f] dark:text-zinc-300">
                  {lateness.hora_llegada}
                </td>
                <td className="px-4 py-3 text-sm text-right tabular-nums text-[#0b1c30] dark:text-zinc-200">
                  {lateness.minutos_retardo} min
                </td>
                <td className="px-5 py-3 text-sm text-[#0b1c30] dark:text-zinc-200">
                  {CLASSIFICATION_LABELS[lateness.classification]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
