import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { IPtuDistribution } from "@/interfaces/payroll_ptu";
import { PTU_TAXPAYER_TYPE_LABELS } from "@/lib/payroll/constants";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import DeletePtuDistributionButton from "./DeletePtuDistributionButton";
import { EditPtuDistributionButton } from "./PtuDistributionActions";
import { PtuDistributionStatusBadge } from "./PtuDistributionBadges";

const MONEY_CELL = "px-6 py-4 text-sm text-right tabular-nums whitespace-nowrap";

export default function PtuDistributionsTable({ distributions }: { distributions: IPtuDistribution[] }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
            <tr>
              <th className="px-6 py-4 font-semibold">Ejercicio</th>
              <th className="px-6 py-4 font-semibold">Persona</th>
              <th className="px-6 py-4 font-semibold text-right">Fondo</th>
              <th className="px-6 py-4 font-semibold text-right">Repartido</th>
              <th className="px-6 py-4 font-semibold text-right">Remanente</th>
              <th className="px-6 py-4 font-semibold">Estado</th>
              <th className="px-6 py-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {distributions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-[#747780] dark:text-zinc-500">
                  Aún no hay repartos de PTU. Crea el del ejercicio con «Nuevo reparto de PTU».
                </td>
              </tr>
            ) : (
              distributions.map((distribution) => (
                <tr
                  key={distribution.id_ptu_distribution}
                  className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-6 py-4 font-semibold text-[#0b1c30] dark:text-zinc-100 whitespace-nowrap">
                    {distribution.ejercicio}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#44474f] dark:text-zinc-400 whitespace-nowrap">
                    {PTU_TAXPAYER_TYPE_LABELS[distribution.tipo_persona]}
                  </td>
                  <td className={`${MONEY_CELL} font-semibold text-[#0b1c30] dark:text-zinc-100`}>
                    {formatPayrollCurrency(distribution.fondo)}
                  </td>
                  <td className={`${MONEY_CELL} text-[#0b1c30] dark:text-zinc-200`}>
                    {formatPayrollCurrency(distribution.total_repartido)}
                  </td>
                  <td
                    className={`${MONEY_CELL} text-[#44474f] dark:text-zinc-400`}
                    title="Lo que excede los topes más la diferencia por redondeo"
                  >
                    {formatPayrollCurrency(distribution.remanente_topes + distribution.remanente_redondeo)}
                  </td>
                  <td className="px-6 py-4">
                    <PtuDistributionStatusBadge status={distribution.estado} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/dashboard/nomina/ptu/${distribution.id_ptu_distribution}`}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[#0051d5] hover:bg-[#0051d5]/10 transition-colors"
                      >
                        Abrir
                        <ChevronRight size={14} />
                      </Link>
                      {distribution.estado === "B" && (
                        <>
                          <EditPtuDistributionButton distribution={distribution} />
                          <DeletePtuDistributionButton
                            idPtuDistribution={distribution.id_ptu_distribution}
                            fiscalYear={distribution.ejercicio}
                          />
                        </>
                      )}
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
