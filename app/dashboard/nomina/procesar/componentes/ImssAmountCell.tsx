import type { ImssStatus } from "@/interfaces/payroll_imss";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

/** IMSS retenido del renglón (spec 91): el importe si se calculó, "No calculado" en 'N' y "—" en 'X'. */
export function ImssAmountCell({ imssStatus, imssWithheld }: { imssStatus: ImssStatus; imssWithheld: number | null }) {
  return (
    <td className="px-4 py-3.5 text-sm text-right tabular-nums whitespace-nowrap">
      {imssStatus === "C" && imssWithheld !== null ? (
        <span className="text-[#0b1c30] dark:text-zinc-200">{formatPayrollCurrency(imssWithheld)}</span>
      ) : imssStatus === "N" ? (
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">No calculado</span>
      ) : (
        <span className="text-[#747780] dark:text-zinc-500" title="No aplica, o recalcula la nómina para ver el IMSS">—</span>
      )}
    </td>
  );
}
