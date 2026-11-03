import type { ReactNode } from "react";
import { CalendarClock, Landmark, Wallet } from "lucide-react";
import type { IPendingDaysSummary } from "@/interfaces/payroll_pending_days";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

interface Props {
  summary: IPendingDaysSummary;
}

function SummaryCard({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-4 shadow-sm flex items-center gap-3 min-w-0">
      <span className="w-10 h-10 shrink-0 rounded-xl bg-[#dce9ff] dark:bg-zinc-800 text-[#0051d5] dark:text-blue-300 flex items-center justify-center">
        {icon}
      </span>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
          {label}
        </span>
        {children}
      </div>
    </div>
  );
}

const VALUE_CLASSES = "text-2xl font-bold leading-tight text-[#0b1c30] dark:text-zinc-50 tabular-nums";
const HINT_CLASSES = "text-xs text-[#44474f] dark:text-zinc-400";

/** Totales de todo el periodo: no cambian con el buscador. */
export default function PendingDaysSummaryCards({ summary }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <SummaryCard icon={<CalendarClock size={20} />} label="Días capturados">
        <span className={VALUE_CLASSES}>{summary.capturedDays}</span>
        <span className={HINT_CLASSES}>Del periodo seleccionado</span>
      </SummaryCard>
      <SummaryCard icon={<Wallet size={20} />} label="Total estimado operativa">
        <span className={VALUE_CLASSES}>{formatPayrollCurrency(summary.totalOperativa)}</span>
        <span className={HINT_CLASSES}>Se confirma al calcular la nómina</span>
      </SummaryCard>
      <SummaryCard icon={<Landmark size={20} />} label="Total estimado fiscal">
        <span className={VALUE_CLASSES}>{formatPayrollCurrency(summary.totalFiscal)}</span>
        <span className={HINT_CLASSES}>Se confirma al calcular la nómina</span>
      </SummaryCard>
    </div>
  );
}
