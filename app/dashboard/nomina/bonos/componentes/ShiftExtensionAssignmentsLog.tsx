import { ArrowRight, ChevronDown } from "lucide-react";
import type { IShiftExtensionAssignmentLogEntry } from "@/interfaces/payroll_shift_extension_bonus";
import { formatDateTimeSlashed } from "@/lib/payroll/moneyFormat";

interface Props {
  entries: IShiftExtensionAssignmentLogEntry[];
}

function formatAssignment(isAssigned: boolean | null): string {
  if (isAssigned === null) return "—";
  return isAssigned ? "Asignado" : "Sin asignar";
}

/** Plegable para que la lista de podólogos siga siendo lo primero que se ve; sin JavaScript de cliente. */
export default function ShiftExtensionAssignmentsLog({ entries }: Props) {
  return (
    <details className="group bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-3.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-50 hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors [&::-webkit-details-marker]:hidden">
        <span>
          Historial de asignaciones
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
              <th scope="col" className="px-6 py-3 font-semibold">Empleado</th>
              <th scope="col" className="px-6 py-3 font-semibold">Bono</th>
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
                <tr key={entry.id_log} className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors align-top">
                  <td className="px-6 py-3.5 whitespace-nowrap tabular-nums text-[#0b1c30] dark:text-zinc-100">
                    {formatDateTimeSlashed(entry.updated_at)}
                  </td>
                  <td className="px-6 py-3.5 text-[#0b1c30] dark:text-zinc-100">{entry.updated_by_name || "—"}</td>
                  <td className="px-6 py-3.5 font-semibold text-[#0b1c30] dark:text-zinc-100">
                    {entry.nombre_completo}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <span className="text-[#747780] dark:text-zinc-500 line-through">
                        {formatAssignment(entry.activo_anterior)}
                      </span>
                      <ArrowRight size={14} aria-hidden className="text-[#747780] dark:text-zinc-500" />
                      <span className="font-semibold text-[#0051d5] dark:text-blue-300">
                        {formatAssignment(entry.activo_nuevo)}
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
