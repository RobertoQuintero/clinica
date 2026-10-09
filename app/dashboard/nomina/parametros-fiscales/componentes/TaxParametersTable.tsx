import type { ITaxParameter } from "@/interfaces/payroll_tax_parameters";
import { TAX_PARAMETER_KEYS } from "@/lib/payroll/constants";
import { formatPeriodDate } from "@/lib/payroll/periodFormat";
import { formatTaxParameterValue } from "@/lib/payroll/taxParametersFormat";
import PayrollEmptyState from "../../componentes/PayrollEmptyState";
import DeleteTaxParameterButton from "./DeleteTaxParameterButton";
import { EditTaxParameterButton } from "./TaxParameterModal";

interface Props {
  parameters: ITaxParameter[];
  year: number;
}

export default function TaxParametersTable({ parameters, year }: Props) {
  if (parameters.length === 0) {
    return (
      <PayrollEmptyState
        title={`Sin parámetros con vigencia en ${year}`}
        description="Aquí aparecen la UMA, el salario mínimo y el subsidio cuya vigencia inicia en el ejercicio seleccionado."
      />
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
            <tr>
              <th className="px-6 py-4 font-semibold">Parámetro</th>
              <th className="px-6 py-4 font-semibold">Vigente desde</th>
              <th className="px-6 py-4 font-semibold text-right">Valor</th>
              <th className="px-6 py-4 font-semibold">Capturado por</th>
              <th className="px-6 py-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {parameters.map((parameter) => (
              <tr key={parameter.id_tax_parameter} className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors">
                <td className="px-6 py-4 font-semibold text-[#0b1c30] dark:text-zinc-100">
                  {TAX_PARAMETER_KEYS[parameter.clave].label}
                </td>
                <td className="px-6 py-4 whitespace-nowrap tabular-nums text-[#0b1c30] dark:text-zinc-100">
                  {formatPeriodDate(parameter.vigente_desde)}
                </td>
                <td className="px-6 py-4 text-right font-semibold tabular-nums whitespace-nowrap text-[#0b1c30] dark:text-zinc-100">
                  {formatTaxParameterValue(parameter.clave, parameter.valor)}
                </td>
                <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">{parameter.updated_by_name || "—"}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <EditTaxParameterButton parameter={parameter} year={year} />
                    <DeleteTaxParameterButton
                      idTaxParameter={parameter.id_tax_parameter}
                      parameterLabel={`${TAX_PARAMETER_KEYS[parameter.clave].label} desde ${formatPeriodDate(parameter.vigente_desde)}`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
