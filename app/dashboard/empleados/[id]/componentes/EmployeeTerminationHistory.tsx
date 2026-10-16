import Link from "next/link";
import { IEmployeeRecord } from "@/interfaces/employee";
import type { IEmployeeTermination } from "@/interfaces/employee_termination";
import { TERMINATION_TYPE_LABELS } from "@/lib/terminations/terminationRules";
import { dayFirst } from "@/utils/date_helpper";
import { getEmployeeTerminations } from "../bajas/actions";

interface Props {
  employee: IEmployeeRecord;
}

/** "YYYY-MM-DD HH:mm:ss" → "dd/mm/aaaa HH:mm", normalizado para no parsearlo como UTC. */
function formatTimestamp(timestamp: string): string {
  const normalized = timestamp.replace(" ", "T");
  return `${dayFirst(normalized)} ${normalized.slice(11, 16)}`;
}

function TerminationEntry({ termination }: { termination: IEmployeeTermination }) {
  const isCancelled = termination.anulado_at !== null;

  return (
    <li
      className={`rounded-lg border px-4 py-3 text-sm flex flex-col gap-1 ${
        isCancelled
          ? "border-[#c4c6d0] dark:border-zinc-700 bg-[#eff4ff]/40 dark:bg-zinc-800/40"
          : "border-[#ba1a1a]/30 dark:border-red-800 bg-[#ba1a1a]/5 dark:bg-red-900/10"
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`font-semibold ${
            isCancelled ? "text-[#44474f] dark:text-zinc-400 line-through" : "text-[#ba1a1a] dark:text-red-400"
          }`}
        >
          Baja · {dayFirst(termination.fecha_baja + "T00:00:00")} · {termination.nombre_causa} ·{" "}
          {TERMINATION_TYPE_LABELS[termination.tipo_terminacion]}
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
            isCancelled
              ? "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600"
              : "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
          }`}
        >
          {isCancelled ? "Anulada" : "Vigente"}
        </span>
      </div>
      {termination.observaciones && (
        <p className="text-[#0b1c30] dark:text-zinc-100 break-words">{termination.observaciones}</p>
      )}
      <p className="text-xs text-[#44474f] dark:text-zinc-400">
        Registrada por {termination.registrado_by_nombre || "—"} el {formatTimestamp(termination.registrado_at)}
      </p>
      {isCancelled && termination.anulado_at && (
        <p className="text-xs text-[#44474f] dark:text-zinc-400 break-words">
          Anulada por {termination.anulado_by_nombre ?? "—"} el {formatTimestamp(termination.anulado_at)}
          {termination.motivo_anulacion ? `: ${termination.motivo_anulacion}` : ""}
        </p>
      )}
    </li>
  );
}

/**
 * Bloque "Historial de bajas" de la pestaña General (spec 86): bajas vigentes y anuladas, de la más
 * reciente a la más antigua, más los vínculos de reingreso. No se pinta si no hay nada que mostrar.
 */
export default async function EmployeeTerminationHistory({ employee }: Props) {
  const terminations = await getEmployeeTerminations(employee.id_empleado);
  const hasRehireLinks = employee.reingreso !== null || employee.id_empleado_anterior !== null;
  if (terminations.length === 0 && !hasRehireLinks) return null;

  return (
    <div>
      <h3 className="text-sm font-bold text-[#0b1c30] dark:text-zinc-100 mb-4 pb-2 border-b border-[#c4c6d0]/50 dark:border-zinc-700/50">
        Historial de bajas
      </h3>

      {hasRehireLinks && (
        <div className="mb-4 flex flex-col gap-1 text-sm">
          {employee.id_empleado_anterior !== null && employee.codigo_empleado_anterior && (
            <p className="text-[#0b1c30] dark:text-zinc-100">
              Reingreso de{" "}
              <Link
                href={`/dashboard/empleados/${employee.id_empleado_anterior}`}
                className="font-semibold text-[#0051d5] dark:text-blue-400 hover:underline"
              >
                {employee.codigo_empleado_anterior}
              </Link>
            </p>
          )}
          {employee.reingreso && (
            <p className="text-[#0b1c30] dark:text-zinc-100">
              Reingresó como{" "}
              <Link
                href={`/dashboard/empleados/${employee.reingreso.id_empleado}`}
                className="font-semibold text-[#0051d5] dark:text-blue-400 hover:underline"
              >
                {employee.reingreso.codigo_empleado}
              </Link>
            </p>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {terminations.map((termination) => (
          <TerminationEntry key={termination.id_employee_termination} termination={termination} />
        ))}
      </ul>
    </div>
  );
}
