import type { ICommissionTier } from "@/interfaces/payroll_commission";
import { formatTierRange } from "@/lib/payroll/commissionTiers";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { EditCommissionTierButton } from "./CommissionTierModal";
import DeleteCommissionTierButton from "./DeleteCommissionTierButton";

interface Props {
  tiers: ICommissionTier[];
}

export default function CommissionTiersTable({ tiers }: Props) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
            <tr>
              <th className="px-6 py-4 font-semibold">Rango de consultas</th>
              <th className="px-6 py-4 font-semibold text-right">Comisión fija</th>
              <th className="px-6 py-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {tiers.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-[#747780] dark:text-zinc-500">
                  No hay tramos de comisión configurados
                </td>
              </tr>
            ) : (
              tiers.map((tier) => (
                <tr key={tier.id_commission_tier} className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-[#0b1c30] dark:text-zinc-100 whitespace-nowrap">
                    {formatTierRange(tier)}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100 whitespace-nowrap">
                    {formatPayrollCurrency(tier.importe)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <EditCommissionTierButton tier={tier} tiers={tiers} />
                      <DeleteCommissionTierButton
                        idCommissionTier={tier.id_commission_tier}
                        tierLabel={formatTierRange(tier)}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
