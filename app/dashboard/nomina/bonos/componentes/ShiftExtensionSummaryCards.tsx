import type { ReactNode } from "react";
import { Banknote, UserCheck } from "lucide-react";
import type { IShiftExtensionBonusPage } from "@/interfaces/payroll_shift_extension_bonus";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

interface Props {
  summary: IShiftExtensionBonusPage["summary"];
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

/** Totales de todo el periodo: no cambian con el filtro de asignación ni con la búsqueda. */
export default function ShiftExtensionSummaryCards({ summary }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SummaryCard icon={<UserCheck size={20} />} label="Podólogos asignados">
        <span className={VALUE_CLASSES}>{summary.assigned}</span>
        <span className={HINT_CLASSES}>Con el bono activo al calcular</span>
      </SummaryCard>
      <SummaryCard icon={<Banknote size={20} />} label="Importe estimado">
        <span className={VALUE_CLASSES}>{formatPayrollCurrency(summary.estimatedAmount)}</span>
        <span className={HINT_CLASSES}>Con el salario diario actual</span>
      </SummaryCard>
    </div>
  );
}
