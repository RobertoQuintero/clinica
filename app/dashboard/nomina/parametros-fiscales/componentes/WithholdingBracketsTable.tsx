import type { IWithholdingBracket } from "@/interfaces/payroll_tax_parameters";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import PayrollEmptyState from "../../componentes/PayrollEmptyState";

interface Props {
  brackets: IWithholdingBracket[];
  year: number;
}

export default function WithholdingBracketsTable({ brackets, year }: Props) {
  if (brackets.length === 0) {
    return (
      <PayrollEmptyState
        title={`Sin tarifa semanal del ISR para ${year}`}
        description="Captura los tramos del ejercicio para que la nómina fiscal pueda calcular la retención."
      />
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
            <tr>
              <th className="px-6 py-4 font-semibold text-right">Límite inferior</th>
              <th className="px-6 py-4 font-semibold text-right">Límite superior</th>
              <th className="px-6 py-4 font-semibold text-right">Cuota fija</th>
              <th className="px-6 py-4 font-semibold text-right">% sobre el excedente</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
