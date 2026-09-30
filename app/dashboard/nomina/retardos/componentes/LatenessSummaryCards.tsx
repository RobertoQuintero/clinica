import type { ReactNode } from "react";
import { AlarmClockOff, CircleCheckBig, CircleSlash, Timer } from "lucide-react";
import type { ILatenessPage } from "@/interfaces/payroll_lateness";

interface Props {
  summary: ILatenessPage["summary"];
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

/** Totales de todo el periodo: no cambian con los filtros de estado, tipo ni búsqueda. */
export default function LatenessSummaryCards({ summary }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <SummaryCard icon={<AlarmClockOff size={20} />} label="Graves injustificados">
        <span className={VALUE_CLASSES}>{summary.severeUnjustified}</span>
        <span className={HINT_CLASSES}>Cada uno descuenta por separado</span>
      </SummaryCard>
      <SummaryCard icon={<Timer size={20} />} label="Acumulables injustificados">
        <span className={VALUE_CLASSES}>{summary.accumulableUnjustified}</span>
        <span className={HINT_CLASSES}>Suman para los escalones del periodo</span>
      </SummaryCard>
      <SummaryCard icon={<CircleCheckBig size={20} />} label="Justificados">
        <span className={VALUE_CLASSES}>{summary.justified}</span>
        <span className={HINT_CLASSES}>Con archivo, no se descuentan</span>
      </SummaryCard>
      <SummaryCard icon={<CircleSlash size={20} />} label="No aplica">
        <span className={VALUE_CLASSES}>{summary.notApplicable}</span>
        <span className={HINT_CLASSES}>Con comentario, no se descuentan</span>
      </SummaryCard>
    </div>
  );
}
