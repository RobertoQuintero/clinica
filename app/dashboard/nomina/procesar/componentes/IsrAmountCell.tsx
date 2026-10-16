import type { IsrStatus } from "@/interfaces/payroll_isr";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

/** ISR retenido del renglón (spec 70): el importe si se calculó, "No calculado" en 'N' y "—" en 'X'. */
export function IsrAmountCell({ isrStatus, isrWithheld }: { isrStatus: IsrStatus; isrWithheld: number | null }) {
  return (
    <td className="px-4 py-3.5 text-sm text-right tabular-nums whitespace-nowrap">
      {isrStatus === "C" && isrWithheld !== null ? (
        <span className="text-[#0b1c30] dark:text-zinc-200">{formatPayrollCurrency(isrWithheld)}</span>
      ) : isrStatus === "N" ? (
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">No calculado</span>
      ) : (
        <span className="text-[#747780] dark:text-zinc-500" title="Recalcula la nómina para ver el ISR">—</span>
      )}
    </td>
  );
}
