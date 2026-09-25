import type { ReactNode } from "react";
import { CalendarClock, CircleCheckBig, Hourglass } from "lucide-react";
import type { IOvertimePage } from "@/interfaces/payroll_overtime";
import { formatOvertimeHours } from "@/lib/payroll/overtimeFormat";

interface Props {
  summary: IOvertimePage["summary"];
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

/** Totales de todo el periodo: no cambian con el filtro de estado ni con la búsqueda. */
export default function OvertimeSummaryCards({ summary }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <SummaryCard icon={<Hourglass size={20} />} label="Días pendientes">
        <span className="text-2xl font-bold leading-tight text-[#0b1c30] dark:text-zinc-50 tabular-nums">
          {summary.pendingDays}
        </span>
        <span className="text-xs text-[#44474f] dark:text-zinc-400">Esperan tu decisión</span>
      </SummaryCard>
      <SummaryCard icon={<CalendarClock size={20} />} label="Horas detectadas">
        <span className="text-2xl font-bold leading-tight text-[#0b1c30] dark:text-zinc-50 tabular-nums">
          {formatOvertimeHours(summary.detectedHours)}
        </span>
        <span className="text-xs text-[#44474f] dark:text-zinc-400">Según las checadas del periodo</span>
      </SummaryCard>
      <SummaryCard icon={<CircleCheckBig size={20} />} label="Horas autorizadas">
        <span className="text-2xl font-bold leading-tight text-[#0b1c30] dark:text-zinc-50 tabular-nums">
          {formatOvertimeHours(summary.authorizedHours)}
        </span>
        <span className="text-xs text-[#44474f] dark:text-zinc-400">Se pagan al calcular la nómina</span>
      </SummaryCard>
    </div>
  );
}
