import { ArrowRight, ChevronDown } from "lucide-react";
import type { IOvertimeSettingsLogEntry } from "@/interfaces/payroll_overtime";
import { formatDateTimeSlashed } from "@/lib/payroll/moneyFormat";
import { formatOvertimeHours } from "@/lib/payroll/overtimeFormat";

interface Props {
  entries: IOvertimeSettingsLogEntry[];
}

/** "9 h → 10.5 h": resalta el valor nuevo solo si cambió; si no, todo en tono secundario. */
function ChangeCell({ previous, next }: { previous: number | null; next: number }) {
  const hasChanged = previous !== next;
  return (
    <span className="inline-flex items-center gap-2 tabular-nums whitespace-nowrap">
      <span
        className={
          hasChanged
            ? "text-[#747780] dark:text-zinc-500 line-through"
            : "text-[#44474f] dark:text-zinc-400"
        }
      >
        {previous === null ? "—" : formatOvertimeHours(previous)}
      </span>
      <ArrowRight size={14} aria-hidden className="text-[#747780] dark:text-zinc-500" />
      <span
        className={
          hasChanged ? "font-semibold text-[#0051d5] dark:text-blue-300" : "text-[#44474f] dark:text-zinc-400"
        }
      >
        {formatOvertimeHours(next)}
      </span>
    </span>
  );
}

/** Plegable para que la lista de días siga siendo lo primero que se ve; sin JavaScript de cliente. */
export default function OvertimeSettingsLog({ entries }: Props) {
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
              <th scope="col" className="px-6 py-3 font-semibold">Límite de horas dobles</th>
              <th scope="col" className="px-6 py-3 font-semibold">Tope por día</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-[#747780] dark:text-zinc-500">
                  Sin cambios registrados
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id_log} className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-3.5 whitespace-nowrap tabular-nums text-[#0b1c30] dark:text-zinc-100">
                    {formatDateTimeSlashed(entry.updated_at)}
                  </td>
                  <td className="px-6 py-3.5 text-[#0b1c30] dark:text-zinc-100">{entry.updated_by_name || "—"}</td>
                  <td className="px-6 py-3.5">
                    <ChangeCell
                      previous={entry.limite_horas_dobles_periodo_anterior}
                      next={entry.limite_horas_dobles_periodo_nuevo}
                    />
                  </td>
                  <td className="px-6 py-3.5">
                    <ChangeCell previous={entry.tope_horas_dia_anterior} next={entry.tope_horas_dia_nuevo} />
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
