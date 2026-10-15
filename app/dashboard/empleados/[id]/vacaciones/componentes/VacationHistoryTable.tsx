import type { IVacationEntitlementView, IVacationLogEntry } from "@/interfaces/vacation";
import {
  formatDateTimeForDisplay,
  formatIsoDateForDisplay,
  getVacationStatusLabel,
  VACATION_LOG_ACTION_LABELS,
} from "@/lib/vacations/vacationFormatting";
import VacationStatusBadge from "@/app/dashboard/empleados/componentes/VacationStatusBadge";
import VacationPayrollStatus from "./VacationPayrollStatus";

interface Props {
  entitlements: IVacationEntitlementView[];
}

function describeLogEntry(entry: IVacationLogEntry): string {
  const formatBlock = (start: string | null, end: string | null, days: number | null) =>
    `${formatIsoDateForDisplay(start)} al ${formatIsoDateForDisplay(end)} (${days} ${days === 1 ? "día" : "días"})`;

  switch (entry.accion) {
    case "C":
      return formatBlock(entry.fecha_inicio_nueva, entry.fecha_fin_nueva, entry.dias_tomados_nueva);
    case "R":
      return `${formatBlock(entry.fecha_inicio_anterior, entry.fecha_fin_anterior, entry.dias_tomados_anterior)} → ${formatBlock(entry.fecha_inicio_nueva, entry.fecha_fin_nueva, entry.dias_tomados_nueva)}`;
    case "X":
      return `Bloque cancelado: ${formatBlock(entry.fecha_inicio_anterior, entry.fecha_fin_anterior, entry.dias_tomados_anterior)}`;
    case "P":
    case "V":
      return `${entry.dias_pagados} ${entry.dias_pagados === 1 ? "día" : "días"} · fecha de pago ${formatIsoDateForDisplay(entry.fecha_pago)}`;
  }
}

export default function VacationHistoryTable({ entitlements }: Props) {
  return (
    <section
      aria-label="Historial de vacaciones"
      className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm"
    >
      <header className="p-5 border-b border-[#c4c6d0] dark:border-zinc-700">
        <h3 className="text-lg font-bold text-[#0b1c30] dark:text-zinc-50">Historial</h3>
        <p className="text-sm text-[#44474f] dark:text-zinc-400 mt-0.5">
          Todos los años de derecho, con los movimientos de cada uno.
        </p>
      </header>

      <ul className="divide-y divide-[#c4c6d0] dark:divide-zinc-700">
        {entitlements.map((entitlement) => (
          <li key={entitlement.id_vacation_entitlement}>
            <details className="group">
              <summary className="list-none cursor-pointer px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-2 hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors [&::-webkit-details-marker]:hidden">
                <span className="font-semibold text-sm text-[#0b1c30] dark:text-zinc-50 w-28">
                  Año {entitlement.anio_servicio}
                </span>
                <span className="text-sm text-[#44474f] dark:text-zinc-400 tabular-nums">
                  {formatIsoDateForDisplay(entitlement.fecha_aniversario)} ·{" "}
                  {entitlement.dias_derecho} días
                </span>
                <span className="text-sm text-[#44474f] dark:text-zinc-400 tabular-nums">
                  {entitlement.fecha_inicio
                    ? `${formatIsoDateForDisplay(entitlement.fecha_inicio)} al ${formatIsoDateForDisplay(entitlement.fecha_fin)}`
                    : "Sin bloque"}
                </span>
                <span className="sm:ml-auto flex items-center gap-3">
                  <VacationStatusBadge
                    status={entitlement.status}
                    label={getVacationStatusLabel(entitlement)}
                  />
                  <span className="text-xs text-[#74777f] dark:text-zinc-500 whitespace-nowrap">
                    {entitlement.log.length}{" "}
                    {entitlement.log.length === 1 ? "movimiento" : "movimientos"}
                  </span>
                </span>
              </summary>

              <div className="px-5 pb-4">
                <div className="mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#74777f] dark:text-zinc-500">
                    Nómina
                  </span>
                  <VacationPayrollStatus entitlement={entitlement} />
                </div>
                {entitlement.log.length === 0 ? (
                  <p className="text-sm text-[#74777f] dark:text-zinc-500">
                    Sin movimientos registrados.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-2">
                    {entitlement.log.map((entry) => (
                      <li
                        key={entry.id_log}
                        className="rounded-lg bg-[#f8f9ff] dark:bg-zinc-800/60 px-4 py-3 text-sm"
                      >
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <span className="font-semibold text-[#0b1c30] dark:text-zinc-50">
                            {VACATION_LOG_ACTION_LABELS[entry.accion]}
                          </span>
                          <span className="text-xs text-[#74777f] dark:text-zinc-500">
                            {formatDateTimeForDisplay(entry.created_at)}
                            {entry.created_by_name ? ` · ${entry.created_by_name}` : ""}
                          </span>
                        </div>
                        <p className="text-[#44474f] dark:text-zinc-300 mt-0.5 tabular-nums">
                          {describeLogEntry(entry)}
                        </p>
                        {entry.motivo && (
                          <p className="text-[#44474f] dark:text-zinc-400 mt-0.5">
                            Motivo: {entry.motivo}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
