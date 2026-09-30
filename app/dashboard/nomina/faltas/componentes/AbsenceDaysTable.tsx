import type { AbsenceStatus, IAbsenceDayRow } from "@/interfaces/payroll_absence";
import { ABSENCE_PAGE_SIZE } from "@/lib/payroll/constants";
import { weekdayOfDate } from "@/lib/payroll/overtimeDetection";
import { formatOvertimeDate, formatScheduledDay } from "@/lib/payroll/overtimeFormat";
import PayrollPagerFooter from "../../componentes/PayrollPagerFooter";
import { ClearJustificationButton } from "../../componentes/ClearJustificationButton";
import { JustifyDayButton } from "../../componentes/JustificationUploadModal";
import { MarkNotApplicableButton } from "../../componentes/NotApplicableModal";
import type { IJustificationSummaryItem } from "../../componentes/justificationTypes";
import { clearAbsenceJustification, justifyAbsence, markAbsenceNotApplicable } from "../actions";

interface Props {
  rows: IAbsenceDayRow[];
  totalRows: number;
  page: number;
  hasActiveFilters: boolean;
  /** Periodo en estatus 1 o 2: solo entonces se muestra la columna de acciones. */
  canDecide: boolean;
  idPeriod: number;
  /** Parámetros de URL vigentes (sin `pagina`), para conservar los filtros al paginar. */
  currentSearchParams: Record<string, string>;
}

const BADGE_BASE = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border";

const DISCOUNTED_BADGE_CLASSES =
  "bg-[#dce9ff] text-[#0051d5] border-[#b8d0ff] dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";

const STATUS_BADGES: Record<AbsenceStatus, { label: string; classes: string }> = {
  unjustified: {
    label: "Injustificada",
    classes: "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  },
  justified: {
    label: "Justificada",
    classes:
      "bg-[#009c6b]/10 text-[#009c6b] border-[#009c6b]/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  },
  not_applicable: {
    label: "No aplica",
    classes: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  },
};

/** Resumen del día para el encabezado de los modales de justificación. */
function buildSummaryItems(dayRow: IAbsenceDayRow): IJustificationSummaryItem[] {
  return [
    { label: "Día", value: formatOvertimeDate(dayRow.fecha, weekdayOfDate(dayRow.fecha)) },
    { label: "Horario", value: formatScheduledDay(dayRow.scheduledDay) },
  ];
}

export default function AbsenceDaysTable({
  rows,
  totalRows,
  page,
  hasActiveFilters,
  canDecide,
  idPeriod,
  currentSearchParams,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(totalRows / ABSENCE_PAGE_SIZE));
  const firstShown = totalRows === 0 ? 0 : (page - 1) * ABSENCE_PAGE_SIZE + 1;
  const lastShown = (page - 1) * ABSENCE_PAGE_SIZE + rows.length;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">Faltas por empleado y día</caption>
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold">Empleado</th>
              <th scope="col" className="px-4 py-3 font-semibold">Día</th>
              <th scope="col" className="px-4 py-3 font-semibold">Horario</th>
              <th scope="col" className="px-4 py-3 font-semibold">Estado</th>
              <th scope="col" className="px-6 py-3 font-semibold">Justificante o comentario</th>
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
                <td colSpan={canDecide ? 6 : 5} className="px-6 py-8 text-center text-sm text-[#747780] dark:text-zinc-500">
                  {hasActiveFilters
                    ? "Ningún día coincide con los filtros."
                    : "Este periodo no tiene faltas detectadas."}
                </td>
              </tr>
            ) : (
              rows.map((dayRow) => {
                const badge = STATUS_BADGES[dayRow.status];
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
                      {formatScheduledDay(dayRow.scheduledDay)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`${BADGE_BASE} ${badge.classes}`}>{badge.label}</span>
                        {dayRow.discountedInPeriodCodes.map((periodCode) => (
                          <span key={periodCode} className={`${BADGE_BASE} ${DISCOUNTED_BADGE_CLASSES}`}>
                            Descontada en {periodCode}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-[#44474f] dark:text-zinc-300 max-w-72">
                      {dayRow.url && (
                        <a
                          href={dayRow.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#0051d5] dark:text-blue-300 hover:underline"
                        >
                          Ver archivo
                        </a>
                      )}
                      {dayRow.comentario && <span className="block line-clamp-2">{dayRow.comentario}</span>}
                      {!dayRow.url && !dayRow.comentario && "—"}
                    </td>
                    {canDecide && (
                      <td className="pr-4 py-3.5">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <JustifyDayButton
                            day={dayRow}
                            idPeriod={idPeriod}
                            summaryItems={buildSummaryItems(dayRow)}
                            action={justifyAbsence}
                            uploadFolder="clinica/empleados/faltas"
                            fileNamePrefix="falta"
                          />
                          <MarkNotApplicableButton
                            day={dayRow}
                            idPeriod={idPeriod}
                            summaryItems={buildSummaryItems(dayRow)}
                            action={markAbsenceNotApplicable}
                            description="Una falta que no aplica no se descuenta de la nómina. El comentario queda como constancia."
                            emptyCommentMessage="Escribe por qué no aplica esta falta (festivo, vacaciones, checador sin conexión…)."
                            ariaLabel={`Marcar como no aplica la falta de ${dayRow.nombre_completo}`}
                          />
                          {dayRow.status !== "unjustified" && (
                            <ClearJustificationButton
                              day={dayRow}
                              idPeriod={idPeriod}
                              action={clearAbsenceJustification}
                              ariaLabel={`Volver a injustificada la falta de ${dayRow.nombre_completo}`}
                              buttonLabel="Volver a injustificada"
                            />
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <PayrollPagerFooter
        basePath="/dashboard/nomina/faltas"
        currentSearchParams={currentSearchParams}
        page={page}
        totalPages={totalPages}
        summaryText={
          totalRows === 0
            ? "Sin días para mostrar"
            : `Mostrando ${firstShown}–${lastShown} de ${totalRows} ${totalRows === 1 ? "día" : "días"}`
        }
      />
    </div>
  );
}
