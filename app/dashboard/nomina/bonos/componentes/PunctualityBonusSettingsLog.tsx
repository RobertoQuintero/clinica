import { ArrowRight, ChevronDown } from "lucide-react";
import type { IPunctualityBonusSettingsLogEntry } from "@/interfaces/payroll_punctuality_bonus";
import { formatDateTimeSlashed, formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

interface Props {
  entries: IPunctualityBonusSettingsLogEntry[];
}

/** "$500.00 → $600.00": resalta el valor nuevo solo si cambió; si no, todo en tono secundario. */
function ChangeCell({ previous, next }: { previous: string | null; next: string }) {
  const hasChanged = previous !== next;
  return (
    <span className="inline-flex items-center gap-2 tabular-nums whitespace-nowrap">
      <span
        className={
          hasChanged ? "text-[#747780] dark:text-zinc-500 line-through" : "text-[#44474f] dark:text-zinc-400"
        }
      >
        {previous ?? "—"}
      </span>
      <ArrowRight size={14} aria-hidden className="text-[#747780] dark:text-zinc-500" />
      <span
        className={
          hasChanged ? "font-semibold text-[#0051d5] dark:text-blue-300" : "text-[#44474f] dark:text-zinc-400"
        }
      >
        {next}
      </span>
    </span>
  );
}

function formatIncidents(count: number): string {
  return count === 1 ? "1 incidencia" : `${count} incidencias`;
}

function formatStatus(isActive: boolean): string {
  return isActive ? "Activo" : "Inactivo";
}

/** Plegable para que la lista de podólogos siga siendo lo primero que se ve; sin JavaScript de cliente. */
export default function PunctualityBonusSettingsLog({ entries }: Props) {
  return (
    <details className="group bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-3.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-50 hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors [&::-webkit-details-marker]:hidden">
        <span>
          Historial de cambios
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
              <th scope="col" className="px-6 py-3 font-semibold">Fecha</th>
              <th scope="col" className="px-6 py-3 font-semibold">Usuario</th>
              <th scope="col" className="px-6 py-3 font-semibold">Frecuencia</th>
              <th scope="col" className="px-6 py-3 font-semibold">Monto</th>
              <th scope="col" className="px-6 py-3 font-semibold">Máximo de incidencias</th>
              <th scope="col" className="px-6 py-3 font-semibold">Estatus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-[#747780] dark:text-zinc-500">
                  Sin cambios registrados
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id_log} className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors align-top">
                  <td className="px-6 py-3.5 whitespace-nowrap tabular-nums text-[#0b1c30] dark:text-zinc-100">
                    {formatDateTimeSlashed(entry.updated_at)}
                  </td>
                  <td className="px-6 py-3.5 text-[#0b1c30] dark:text-zinc-100">{entry.updated_by_name || "—"}</td>
                  <td className="px-6 py-3.5 font-semibold text-[#0b1c30] dark:text-zinc-100">{entry.frequencyName}</td>
                  <td className="px-6 py-3.5">
                    <ChangeCell
                      previous={entry.monto_anterior === null ? null : formatPayrollCurrency(entry.monto_anterior)}
                      next={formatPayrollCurrency(entry.monto_nuevo)}
                    />
                  </td>
                  <td className="px-6 py-3.5">
                    <ChangeCell
                      previous={
                        entry.maximo_incidencias_anterior === null
                          ? null
                          : formatIncidents(entry.maximo_incidencias_anterior)
                      }
                      next={formatIncidents(entry.maximo_incidencias_nuevo)}
                    />
                  </td>
                  <td className="px-6 py-3.5">
                    <ChangeCell
                      previous={entry.status_anterior === null ? null : formatStatus(entry.status_anterior)}
                      next={formatStatus(entry.status_nuevo)}
                    />
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
