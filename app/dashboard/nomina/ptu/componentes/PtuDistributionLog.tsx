import { ArrowRight, ChevronDown } from "lucide-react";
import type { IPtuDistributionLogEntry } from "@/interfaces/payroll_ptu";
import { PTU_LOG_ACTION_LABELS, PTU_LOG_FIELD_LABELS, PTU_TAXPAYER_TYPE_LABELS } from "@/lib/payroll/constants";
import { formatDateTimeSlashed, formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import type { PtuTaxpayerType } from "@/interfaces/payroll_ptu";

interface Props {
  entries: IPtuDistributionLogEntry[];
}

/** Valor de la bitácora tal como se muestra: importes con formato de moneda, tipo de persona con su nombre. */
function formatLogValue(field: string, value: string | null): string {
  if (value === null) return "—";
  const fieldType = PTU_LOG_FIELD_LABELS[field]?.type;
  if (fieldType === "money" && value !== "" && !Number.isNaN(Number(value))) return formatPayrollCurrency(Number(value));
  if (fieldType === "taxpayer" && value in PTU_TAXPAYER_TYPE_LABELS) return PTU_TAXPAYER_TYPE_LABELS[value as PtuTaxpayerType];
  return value;
}

function LogChange({ entry }: { entry: IPtuDistributionLogEntry }) {
  // Acciones sin campo (precarga, cierre…): el texto va en valor_nuevo, o no hay detalle.
  if (!entry.campo) return <span className="text-[#44474f] dark:text-zinc-400">{entry.valor_nuevo ?? "—"}</span>;
  const label = PTU_LOG_FIELD_LABELS[entry.campo]?.label ?? entry.campo;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 tabular-nums">
      <span className="text-[#44474f] dark:text-zinc-400">{label}:</span>
      <span className="text-[#747780] dark:text-zinc-500">{formatLogValue(entry.campo, entry.valor_anterior)}</span>
      <ArrowRight size={14} aria-hidden className="text-[#747780] dark:text-zinc-500" />
      <span className="font-semibold text-[#0051d5] dark:text-blue-300">
        {formatLogValue(entry.campo, entry.valor_nuevo)}
      </span>
    </span>
  );
}

/** Plegable para que la tabla de trabajadores siga siendo lo primero que se ve; sin JavaScript de cliente. */
export default function PtuDistributionLog({ entries }: Props) {
  return (
    <details className="group bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-3.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-50 hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors [&::-webkit-details-marker]:hidden">
        <span>
          Bitácora del reparto
          <span className="ml-2 font-normal text-[#44474f] dark:text-zinc-400">
            {entries.length === 0 ? "sin cambios" : `últimas ${entries.length}`}
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
              <th className="px-6 py-4 font-semibold">Acción</th>
              <th className="px-6 py-4 font-semibold">Trabajador</th>
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
                <tr
                  key={entry.id_ptu_distribution_log}
                  className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap tabular-nums text-[#0b1c30] dark:text-zinc-100">
                    {formatDateTimeSlashed(entry.changed_at)}
                  </td>
                  <td className="px-6 py-4 text-[#0b1c30] dark:text-zinc-100">{entry.changed_by_name || "—"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-[#0b1c30] dark:text-zinc-100">
                    {PTU_LOG_ACTION_LABELS[entry.accion]}
                  </td>
                  <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">{entry.nombre_empleado ?? "—"}</td>
                  <td className="px-6 py-4 text-sm">
                    <LogChange entry={entry} />
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
