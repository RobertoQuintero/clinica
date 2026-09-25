import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { IOvertimeDayRow, OvertimeDecisionStatus } from "@/interfaces/payroll_overtime";
import { OVERTIME_PAGE_SIZE } from "@/lib/payroll/constants";
import { weekdayOfDate } from "@/lib/payroll/overtimeDetection";
import { formatOvertimeDate, formatOvertimeHours, formatScheduledDay } from "@/lib/payroll/overtimeFormat";
import { DecideOvertimeButton } from "./OvertimeDecisionModal";

interface Props {
  rows: IOvertimeDayRow[];
  totalRows: number;
  page: number;
  hasActiveFilters: boolean;
  /** Periodo en estatus 1 o 2: solo entonces se muestra la columna de decisión. */
  canDecide: boolean;
  idPeriod: number;
  /** Tope vigente de horas por día, para validar en el modal; null si no hay configuración. */
  dailyCap: number | null;
  /** Parámetros de URL vigentes (sin `pagina`), para conservar los filtros al paginar. */
  currentSearchParams: Record<string, string>;
}

const BADGE_BASE = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border";

const PAID_BADGE_CLASSES =
  "bg-[#dce9ff] text-[#0051d5] border-[#b8d0ff] dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";

const DECISION_BADGES: Record<OvertimeDecisionStatus, { label: string; classes: string }> = {
  pending: {
    label: "Pendiente",
    classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  },
  authorized: {
    label: "Autorizada",
    classes:
      "bg-[#009c6b]/10 text-[#009c6b] border-[#009c6b]/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  },
  rejected: {
    label: "Rechazada",
    classes: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  },
};

function buildPageHref(currentSearchParams: Record<string, string>, page: number): string {
  const searchParams = new URLSearchParams(currentSearchParams);
  if (page > 1) searchParams.set("pagina", String(page));
  else searchParams.delete("pagina");
  const query = searchParams.toString();
  return query ? `/dashboard/nomina/horas-extra?${query}` : "/dashboard/nomina/horas-extra";
}

const PAGER_BUTTON =
  "p-1.5 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 text-[#44474f] dark:text-zinc-300 transition-colors";

export default function OvertimeDaysTable({
  rows,
  totalRows,
  page,
  hasActiveFilters,
  canDecide,
  idPeriod,
  dailyCap,
  currentSearchParams,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(totalRows / OVERTIME_PAGE_SIZE));
  const firstShown = totalRows === 0 ? 0 : (page - 1) * OVERTIME_PAGE_SIZE + 1;
  const lastShown = (page - 1) * OVERTIME_PAGE_SIZE + rows.length;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">Horas extra por empleado y día</caption>
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold">Empleado</th>
              <th scope="col" className="px-4 py-3 font-semibold">Día</th>
              <th scope="col" className="px-4 py-3 font-semibold">Horario</th>
              <th scope="col" className="px-4 py-3 font-semibold">Checadas</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Detectadas</th>
              <th scope="col" className="px-4 py-3 font-semibold">Estado</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Autorizadas</th>
              <th scope="col" className="px-6 py-3 font-semibold">Comentario</th>
              {canDecide && (
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={canDecide ? 9 : 8} className="px-6 py-8 text-center text-sm text-[#747780] dark:text-zinc-500">
                  {hasActiveFilters
                    ? "Ningún día coincide con los filtros."
                    : "Este periodo no tiene horas extra detectadas ni checadas incompletas."}
                </td>
              </tr>
            ) : (
              rows.map((dayRow) => {
                const badge = DECISION_BADGES[dayRow.status];
                const detectionChanged =
                  dayRow.detectedHoursAtDecision !== null && dayRow.detectedHoursAtDecision !== dayRow.detectedHours;
                return (
                  <tr
                    key={`${dayRow.id_empleado}-${dayRow.fecha}`}
                    className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 truncate">
                          {dayRow.nombre_completo}
                        </span>
                        <span className="text-[11px] text-[#747780] dark:text-zinc-500">{dayRow.codigo_empleado}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#0b1c30] dark:text-zinc-200 whitespace-nowrap tabular-nums">
                      {formatOvertimeDate(dayRow.fecha, weekdayOfDate(dayRow.fecha))}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#44474f] dark:text-zinc-300 whitespace-nowrap tabular-nums">
                      {dayRow.scheduledDay ? formatScheduledDay(dayRow.scheduledDay) : "Descanso"}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#44474f] dark:text-zinc-300 whitespace-nowrap tabular-nums">
                      {dayRow.firstCheckIn ?? "—"} → {dayRow.lastCheckOut ?? "—"}
                      {dayRow.isIncomplete && (
                        <span className="block text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          Checada incompleta
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      <span className="block text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
                        {formatOvertimeHours(dayRow.detectedHours)}
                      </span>
                      {detectionChanged && (
                        <span className="block text-[11px] text-amber-700 dark:text-amber-400">
                          Detectado cambió: {dayRow.detectedHoursAtDecision} → {dayRow.detectedHours}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`${BADGE_BASE} ${badge.classes}`}>{badge.label}</span>
                        {dayRow.paidInPeriodCode && (
                          <span className={`${BADGE_BASE} ${PAID_BADGE_CLASSES}`}>
                            Pagada en {dayRow.paidInPeriodCode}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-right tabular-nums text-[#0b1c30] dark:text-zinc-200">
                      {dayRow.authorizedHours !== null ? formatOvertimeHours(dayRow.authorizedHours) : "—"}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-[#44474f] dark:text-zinc-300 max-w-64">
                      <span className="line-clamp-2">{dayRow.comentario ?? "—"}</span>
                    </td>
                    {canDecide && (
                      <td className="pr-4 py-3.5 text-right">
                        <DecideOvertimeButton dayRow={dayRow} idPeriod={idPeriod} dailyCap={dailyCap} />
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 px-6 py-3 bg-[#eff4ff] dark:bg-zinc-800 border-t border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
        <span>
          {totalRows === 0
            ? "Sin días para mostrar"
            : `Mostrando ${firstShown}–${lastShown} de ${totalRows} ${totalRows === 1 ? "día" : "días"}`}
        </span>
        <nav aria-label="Paginación" className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={buildPageHref(currentSearchParams, page - 1)}
              aria-label="Página anterior"
              className={`${PAGER_BUTTON} hover:bg-white dark:hover:bg-zinc-700`}
            >
              <ChevronLeft size={16} />
            </Link>
          ) : (
            <span aria-hidden className={`${PAGER_BUTTON} opacity-40`}>
              <ChevronLeft size={16} />
            </span>
          )}
          <span className="text-xs font-semibold text-[#0b1c30] dark:text-zinc-100">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildPageHref(currentSearchParams, page + 1)}
              aria-label="Página siguiente"
              className={`${PAGER_BUTTON} hover:bg-white dark:hover:bg-zinc-700`}
            >
              <ChevronRight size={16} />
            </Link>
          ) : (
            <span aria-hidden className={`${PAGER_BUTTON} opacity-40`}>
              <ChevronRight size={16} />
            </span>
          )}
        </nav>
      </div>
    </div>
  );
}
