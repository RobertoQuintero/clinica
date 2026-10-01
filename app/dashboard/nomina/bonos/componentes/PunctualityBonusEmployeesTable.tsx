import Link from "next/link";
import type {
  IPunctualityBonusEmployeeRow,
  PunctualityBonusResult,
} from "@/interfaces/payroll_punctuality_bonus";
import { PUNCTUALITY_BONUS_PAGE_SIZE } from "@/lib/payroll/constants";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { describePunctualityBonusSkipReason } from "@/lib/payroll/punctualityBonus";
import { buildIncidentScreenHref } from "@/lib/payroll/punctualityBonusUrls";
import PayrollPagerFooter from "../../componentes/PayrollPagerFooter";

interface Props {
  rows: IPunctualityBonusEmployeeRow[];
  totalRows: number;
  page: number;
  hasActiveFilters: boolean;
  idPeriod: number;
  /** Parámetros de URL vigentes (sin `pagina`), para conservar los filtros al paginar. */
  currentSearchParams: Record<string, string>;
}

const BADGE_BASE = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border";

const RESULT_BADGES: Record<PunctualityBonusResult, { label: string; classes: string }> = {
  keeps: {
    label: "Conserva",
    classes:
      "bg-[#009c6b]/10 text-[#009c6b] border-[#009c6b]/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  },
  loses: {
    label: "Pierde",
    classes: "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  },
  not_evaluated: {
    label: "No evaluado",
    classes: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  },
};

const COUNT_LINK_CLASSES =
  "inline-block min-w-8 rounded-md px-2 py-0.5 text-center font-semibold text-[#0051d5] dark:text-blue-300 underline decoration-[#0051d5]/30 underline-offset-2 hover:bg-[#dce9ff] dark:hover:bg-zinc-800 transition-colors";

/** El conteo lleva a la pantalla donde se justifica; un cero no tiene nada que revisar y se queda como texto. */
function IncidentCountCell({ count, href, label }: { count: number; href: string; label: string }) {
  if (count === 0) return <span className="text-[#44474f] dark:text-zinc-300">0</span>;
  return (
    <Link href={href} aria-label={label} className={COUNT_LINK_CLASSES}>
      {count}
    </Link>
  );
}

export default function PunctualityBonusEmployeesTable({
  rows,
  totalRows,
  page,
  hasActiveFilters,
  idPeriod,
  currentSearchParams,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(totalRows / PUNCTUALITY_BONUS_PAGE_SIZE));
  const firstShown = totalRows === 0 ? 0 : (page - 1) * PUNCTUALITY_BONUS_PAGE_SIZE + 1;
  const lastShown = (page - 1) * PUNCTUALITY_BONUS_PAGE_SIZE + rows.length;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">Bono de puntualidad por podólogo</caption>
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold">Empleado</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Retardos</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Faltas</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Incidencias</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Máximo</th>
              <th scope="col" className="px-4 py-3 font-semibold">Resultado</th>
              <th scope="col" className="px-6 py-3 font-semibold text-right">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-[#747780] dark:text-zinc-500">
                  {hasActiveFilters
                    ? "Ningún podólogo coincide con los filtros."
                    : "Este periodo no tiene podólogos con control de incidencias."}
                </td>
              </tr>
            ) : (
              rows.map((employeeRow) => {
                const resultBadge = RESULT_BADGES[employeeRow.result];
                const isEvaluated = employeeRow.result !== "not_evaluated";
                return (
                  <tr
                    key={employeeRow.id_empleado}
                    className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 truncate">
                          {employeeRow.nombre_completo}
                        </span>
                        <span className="text-[11px] text-[#747780] dark:text-zinc-500">
                          {employeeRow.codigo_empleado}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-right tabular-nums">
                      <IncidentCountCell
                        count={employeeRow.lateCount}
                        href={buildIncidentScreenHref("/dashboard/nomina/retardos", idPeriod, employeeRow.nombre_completo)}
                        label={`Ver retardos de ${employeeRow.nombre_completo}`}
                      />
                    </td>
                    <td className="px-4 py-3.5 text-sm text-right tabular-nums">
                      <IncidentCountCell
                        count={employeeRow.absenceCount}
                        href={buildIncidentScreenHref("/dashboard/nomina/faltas", idPeriod, employeeRow.nombre_completo)}
                        label={`Ver faltas de ${employeeRow.nombre_completo}`}
                      />
                    </td>
                    <td className="px-4 py-3.5 text-sm text-right tabular-nums font-semibold text-[#0b1c30] dark:text-zinc-100">
                      {employeeRow.incidentCount}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-right tabular-nums text-[#44474f] dark:text-zinc-300">
                      {employeeRow.maximumIncidents ?? "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`${BADGE_BASE} ${resultBadge.classes}`}>{resultBadge.label}</span>
                        {employeeRow.skipReason && (
                          <span className="text-xs text-[#44474f] dark:text-zinc-400">
                            {describePunctualityBonusSkipReason(employeeRow.skipReason)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className={`px-6 py-3.5 text-sm text-right tabular-nums font-semibold ${
                        isEvaluated ? "text-[#0b1c30] dark:text-zinc-100" : "text-[#747780] dark:text-zinc-500"
                      }`}
                    >
                      {formatPayrollCurrency(employeeRow.amount)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <PayrollPagerFooter
        basePath="/dashboard/nomina/bonos"
        currentSearchParams={currentSearchParams}
        page={page}
        totalPages={totalPages}
        summaryText={
          totalRows === 0
            ? "Sin resultados"
            : `Mostrando ${firstShown}–${lastShown} de ${totalRows} ${totalRows === 1 ? "podólogo" : "podólogos"}`
        }
      />
    </div>
  );
}
