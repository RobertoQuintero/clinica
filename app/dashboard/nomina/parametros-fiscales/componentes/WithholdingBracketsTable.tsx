import { TriangleAlert } from "lucide-react";
import type { IWithholdingBracket } from "@/interfaces/payroll_tax_parameters";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { findWithholdingGaps } from "@/lib/payroll/taxParameters";
import PayrollEmptyState from "../../componentes/PayrollEmptyState";
import DeleteWithholdingBracketButton from "./DeleteWithholdingBracketButton";
import { EditWithholdingBracketButton } from "./WithholdingBracketModal";

interface Props {
  brackets: IWithholdingBracket[];
  year: number;
}

function formatBracketRange(bracket: IWithholdingBracket): string {
  const upperLimit = bracket.limite_superior === null ? "en adelante" : formatPayrollCurrency(bracket.limite_superior);
  return `${formatPayrollCurrency(bracket.limite_inferior)} ${bracket.limite_superior === null ? "" : "a "}${upperLimit}`;
}

export default function WithholdingBracketsTable({ brackets, year }: Props) {
  if (brackets.length === 0) {
    return (
      <PayrollEmptyState
        title={`Sin tarifa semanal del ISR para ${year}`}
        description="Captura los tramos del ejercicio, o cópialos del anterior, para que la nómina fiscal pueda calcular la retención."
      />
    );
  }

  const gaps = findWithholdingGaps(brackets);

  return (
    <div className="flex flex-col gap-3">
      {gaps.length > 0 && (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
        >
          <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">La tarifa tiene huecos y no se podrá calcular el ISR en ellos.</p>
            <ul className="mt-1 list-disc pl-5 tabular-nums">
              {gaps.map((gap) => (
                <li key={gap.after}>
                  Entre {formatPayrollCurrency(gap.after)} y {formatPayrollCurrency(gap.before)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-semibold text-right">Límite inferior</th>
                <th className="px-6 py-4 font-semibold text-right">Límite superior</th>
                <th className="px-6 py-4 font-semibold text-right">Cuota fija</th>
                <th className="px-6 py-4 font-semibold text-right">% sobre el excedente</th>
                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
              {brackets.map((bracket) => (
                <tr key={bracket.id_tarifa} className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 text-right tabular-nums whitespace-nowrap text-[#0b1c30] dark:text-zinc-100">
                    {formatPayrollCurrency(bracket.limite_inferior)}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums whitespace-nowrap text-[#0b1c30] dark:text-zinc-100">
                    {bracket.limite_superior === null ? "En adelante" : formatPayrollCurrency(bracket.limite_superior)}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums whitespace-nowrap text-[#0b1c30] dark:text-zinc-100">
                    {formatPayrollCurrency(bracket.cuota_fija)}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold tabular-nums whitespace-nowrap text-[#0b1c30] dark:text-zinc-100">
                    {bracket.porcentaje_excedente.toFixed(2)}%
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <EditWithholdingBracketButton bracket={bracket} brackets={brackets} year={year} />
                      <DeleteWithholdingBracketButton
                        idBracket={bracket.id_tarifa}
                        bracketLabel={formatBracketRange(bracket)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
