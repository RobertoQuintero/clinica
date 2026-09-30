import type { ILatenessDayRow, LatenessClassification, LatenessStatus } from "@/interfaces/payroll_lateness";
import { LATENESS_PAGE_SIZE } from "@/lib/payroll/constants";
import { weekdayOfDate } from "@/lib/payroll/overtimeDetection";
import { formatOvertimeDate } from "@/lib/payroll/overtimeFormat";
import PayrollPagerFooter from "../../componentes/PayrollPagerFooter";

interface Props {
  rows: ILatenessDayRow[];
  totalRows: number;
  page: number;
  hasActiveFilters: boolean;
  /** Parámetros de URL vigentes (sin `pagina`), para conservar los filtros al paginar. */
  currentSearchParams: Record<string, string>;
}

const BADGE_BASE = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border";

const DISCOUNTED_BADGE_CLASSES =
  "bg-[#dce9ff] text-[#0051d5] border-[#b8d0ff] dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";

const STATUS_BADGES: Record<LatenessStatus, { label: string; classes: string }> = {
  unjustified: {
    label: "Injustificado",
    classes: "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  },
  justified: {
    label: "Justificado",
    classes:
      "bg-[#009c6b]/10 text-[#009c6b] border-[#009c6b]/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  },
  not_applicable: {
    label: "No aplica",
    classes: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  },
};

const CLASSIFICATION_BADGES: Record<LatenessClassification, { label: string; classes: string }> = {
  severe: {
    label: "Grave",
    classes: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  },
  accumulable: {
    label: "Acumulable",
    classes: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  },
};

export default function LatenessDaysTable({ rows, totalRows, page, hasActiveFilters, currentSearchParams }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalRows / LATENESS_PAGE_SIZE));
  const firstShown = totalRows === 0 ? 0 : (page - 1) * LATENESS_PAGE_SIZE + 1;
  const lastShown = (page - 1) * LATENESS_PAGE_SIZE + rows.length;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">Retardos por empleado y día</caption>
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold">Empleado</th>
              <th scope="col" className="px-4 py-3 font-semibold">Día</th>
              <th scope="col" className="px-4 py-3 font-semibold">Programada</th>
              <th scope="col" className="px-4 py-3 font-semibold">Primera entrada</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Minutos tarde</th>
              <th scope="col" className="px-4 py-3 font-semibold">Tipo</th>
              <th scope="col" className="px-4 py-3 font-semibold">Estado</th>
              <th scope="col" className="px-6 py-3 font-semibold">Justificante o comentario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-[#747780] dark:text-zinc-500">
                  {hasActiveFilters
                    ? "Ningún retardo coincide con los filtros."
                    : "Este periodo no tiene retardos detectados."}
                </td>
              </tr>
            ) : (
              rows.map((dayRow) => {
                const statusBadge = STATUS_BADGES[dayRow.status];
                const classificationBadge = CLASSIFICATION_BADGES[dayRow.classification];
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
                      {dayRow.hora_entrada_1}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#44474f] dark:text-zinc-300 whitespace-nowrap tabular-nums">
                      {dayRow.hora_llegada}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-right font-semibold text-[#0b1c30] dark:text-zinc-100 whitespace-nowrap tabular-nums">
                      {dayRow.minutos} min
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`${BADGE_BASE} ${classificationBadge.classes}`}>{classificationBadge.label}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`${BADGE_BASE} ${statusBadge.classes}`}>{statusBadge.label}</span>
                        {dayRow.discountedInPeriodCodes.map((periodCode) => (
                          <span key={periodCode} className={`${BADGE_BASE} ${DISCOUNTED_BADGE_CLASSES}`}>
                            Descontado en {periodCode}
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
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <PayrollPagerFooter
        basePath="/dashboard/nomina/retardos"
        currentSearchParams={currentSearchParams}
        page={page}
        totalPages={totalPages}
        summaryText={
          totalRows === 0
            ? "Sin retardos para mostrar"
            : `Mostrando ${firstShown}–${lastShown} de ${totalRows} ${totalRows === 1 ? "retardo" : "retardos"}`
        }
      />
    </div>
  );
}
