import { Banknote, CirclePlus, Info } from "lucide-react";
import type { IPayrollPerceptionLine } from "@/interfaces/payroll_calculation";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

interface Props {
  perceptions: IPayrollPerceptionLine[];
  totalPerceptions: number;
}

function describeConceptCount(count: number): string {
  return count === 1 ? "1 concepto" : `${count} conceptos`;
}

export default function PayrollPerceptionsCard({ perceptions, totalPerceptions }: Props) {
  return (
    <section
      aria-labelledby="payroll-perceptions-title"
      className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden"
    >
      <header className="px-5 py-4 bg-[#f8f9ff] dark:bg-zinc-800/60 border-b border-[#e5e8f0] dark:border-zinc-700 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-[#009c6b]/10 dark:bg-emerald-900/30 text-[#009c6b] dark:text-emerald-400 flex items-center justify-center">
            <CirclePlus size={20} aria-hidden />
          </span>
          <div className="flex flex-col">
            <h3 id="payroll-perceptions-title" className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">
              Percepciones totales
            </h3>
            <span className="text-xs text-[#44474f] dark:text-zinc-400">{describeConceptCount(perceptions.length)}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="block text-xl font-bold tabular-nums text-[#009c6b] dark:text-emerald-400">
            {formatPayrollCurrency(totalPerceptions)}
          </span>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            MXN
          </span>
        </div>
      </header>

      <ul className="divide-y divide-[#e5e8f0] dark:divide-zinc-800">
        {perceptions.map((line) => (
          <li key={line.key} className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <span className="w-9 h-9 shrink-0 mt-0.5 rounded-lg bg-[#dce9ff] dark:bg-zinc-800 text-[#0051d5] dark:text-blue-300 flex items-center justify-center">
                <Banknote size={18} aria-hidden />
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">{line.label}</span>
                <span className="mt-0.5 text-sm text-[#44474f] dark:text-zinc-400 tabular-nums">{line.description}</span>
                {line.note && (
                  <span className="mt-1.5 inline-flex items-center gap-1.5 self-start rounded-md bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <Info size={13} aria-hidden />
                    {line.note}
                  </span>
                )}
              </div>
            </div>
            <span className="shrink-0 text-base font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-50">
              {formatPayrollCurrency(line.amount)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
