import type { PtuDistributionStatus } from "@/interfaces/payroll_ptu";
import { PTU_DISTRIBUTION_STATUS_LABELS } from "@/lib/payroll/constants";

const BADGE_BASE = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border";

const STATUS_BADGE_STYLES: Record<PtuDistributionStatus, string> = {
  B: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  C: "bg-[#009c6b]/10 text-[#009c6b] border-[#009c6b]/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
};

export function PtuDistributionStatusBadge({ status }: { status: PtuDistributionStatus }) {
  return <span className={`${BADGE_BASE} ${STATUS_BADGE_STYLES[status]}`}>{PTU_DISTRIBUTION_STATUS_LABELS[status]}</span>;
}
