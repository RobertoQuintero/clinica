import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

/** Gravado o exento de un concepto extraordinario; "—" cuando no hay desglose (el exento no se pudo calcular). */
export function TaxAmountCell({ amount }: { amount: number | null }) {
  return (
    <td className="px-4 py-3.5 text-sm text-right tabular-nums whitespace-nowrap">
      {amount === null ? (
        <span className="text-[#747780] dark:text-zinc-500" title="El exento no se pudo calcular">—</span>
      ) : (
        <span className="text-[#0b1c30] dark:text-zinc-200">{formatPayrollCurrency(amount)}</span>
      )}
    </td>
  );
}
