import { PAYROLL_PERIOD_STATUS } from "@/lib/payroll/constants";
import type { PayrollPeriodStatus } from "@/interfaces/payroll_period";

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

export function PayrollFrequencyBadge({ description }: { description: string }) {
  return (
    <span
      className={`${BADGE_BASE} bg-[#dbe1ff] text-[#00174b] border-transparent dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700`}
    >
      {description}
    </span>
  );
}
