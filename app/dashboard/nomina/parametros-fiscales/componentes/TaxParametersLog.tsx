import { ArrowRight, ChevronDown } from "lucide-react";
import type { ITaxParametersLogEntry } from "@/interfaces/payroll_tax_parameters";
import { TAX_PARAMETER_KEYS } from "@/lib/payroll/constants";
import { formatPeriodDate } from "@/lib/payroll/periodFormat";
import { formatDateTimeSlashed } from "@/lib/payroll/moneyFormat";
import { formatTaxParameterValue } from "@/lib/payroll/taxParametersFormat";

interface Props {
  entries: ITaxParametersLogEntry[];
}

/** Plegable para que la tabla siga siendo lo primero que se ve; sin JavaScript de cliente. */
export default function TaxParametersLog({ entries }: Props) {
  return (
    <details className="group bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-3.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-50 hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors [&::-webkit-details-marker]:hidden">
        <span>
          Bitácora de parámetros
          <span className="ml-2 font-normal text-[#44474f] dark:text-zinc-400">
            {entries.length === 0 ? "sin cambios" : `últimos ${entries.length}`}
          </span>
        </span>
        <ChevronDown size={18} aria-hidden className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="overflow-x-auto border-t border-[#c4c6d0] dark:border-zinc-700">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
            <tr>
              <th className="px-6 py-4 font-semibold">Fecha</th>
              <th className="px-6 py-4 font-semibold">Usuario</th>
              <th className="px-6 py-4 font-semibold">Parámetro</th>
              <th className="px-6 py-4 font-semibold">Vigente desde</th>
              <th className="px-6 py-4 font-semibold">Cambio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-[#747780] dark:text-zinc-500">
                  Sin cambios registrados
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id_log} className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap tabular-nums text-[#0b1c30] dark:text-zinc-100">
                    {formatDateTimeSlashed(entry.updated_at)}
                  </td>
                  <td className="px-6 py-4 text-[#0b1c30] dark:text-zinc-100">{entry.updated_by_name || "—"}</td>
                  <td className="px-6 py-4 text-[#0b1c30] dark:text-zinc-100">{TAX_PARAMETER_KEYS[entry.clave].label}</td>
                  <td className="px-6 py-4 whitespace-nowrap tabular-nums text-[#44474f] dark:text-zinc-400">
                    {formatPeriodDate(entry.vigente_desde)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-2 tabular-nums whitespace-nowrap">
                      <span className="text-[#747780] dark:text-zinc-500">
                        {entry.valor_anterior === null ? "Alta" : formatTaxParameterValue(entry.clave, entry.valor_anterior)}
                      </span>
                      <ArrowRight size={14} aria-hidden className="text-[#747780] dark:text-zinc-500" />
                      <span className="font-semibold text-[#0051d5] dark:text-blue-300">
                        {entry.valor_nuevo === null ? "Baja" : formatTaxParameterValue(entry.clave, entry.valor_nuevo)}
                      </span>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}
