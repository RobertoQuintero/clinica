import { EXTRAORDINARY_CONCEPT_LABELS, PAYROLL_PERIOD_STATUS, PAYROLL_PERIOD_TYPE_LABELS } from "@/lib/payroll/constants";
import type { ExtraordinaryConcept, PayrollPeriodStatus, PayrollPeriodType } from "@/interfaces/payroll_period";

const BADGE_BASE = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border";

const STATUS_BADGE_STYLES = {
  neutral: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  info: "bg-[#0051d5]/10 text-[#0051d5] border-[#0051d5]/20 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  success: "bg-[#009c6b]/10 text-[#009c6b] border-[#009c6b]/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
} as const;

export function PayrollStatusBadge({ status }: { status: PayrollPeriodStatus }) {
  const { label, badge } = PAYROLL_PERIOD_STATUS[status];
  return <span className={`${BADGE_BASE} ${STATUS_BADGE_STYLES[badge]}`}>{label}</span>;
}

const EXTRAORDINARY_BADGE_STYLES: Record<ExtraordinaryConcept, string> = {
  A: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
  P: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800",
};

/** Frecuencia del periodo; en uno extraordinario muestra su concepto (Aguinaldo o PTU) en lugar de la periodicidad 99. */
export function PayrollFrequencyBadge({
  description,
  periodType = "O",
  extraordinaryConcept = null,
}: {
  description: string;
  periodType?: PayrollPeriodType;
  extraordinaryConcept?: ExtraordinaryConcept | null;
}) {
  if (periodType === "E") {
    return (
      <span className={`${BADGE_BASE} ${EXTRAORDINARY_BADGE_STYLES[extraordinaryConcept ?? "A"]}`}>
        {extraordinaryConcept ? EXTRAORDINARY_CONCEPT_LABELS[extraordinaryConcept] : PAYROLL_PERIOD_TYPE_LABELS.E}
      </span>
    );
  }
  return (
    <span
      className={`${BADGE_BASE} bg-[#dbe1ff] text-[#00174b] border-transparent dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700`}
    >
      {description}
    </span>
  );
}
