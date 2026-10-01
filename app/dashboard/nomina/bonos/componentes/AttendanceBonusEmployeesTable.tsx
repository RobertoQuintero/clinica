import Link from "next/link";
import type { BonusResult } from "@/interfaces/payroll_bonus";
import type { IAttendanceBonusEmployeeRow } from "@/interfaces/payroll_attendance_bonus";
import { describeAttendanceBonusSkipReason } from "@/lib/payroll/attendanceBonus";
import { buildIncidentScreenHref } from "@/lib/payroll/bonusUrls";
import { ATTENDANCE_BONUS_PAGE_SIZE } from "@/lib/payroll/constants";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import PayrollPagerFooter from "../../componentes/PayrollPagerFooter";

interface Props {
  rows: IAttendanceBonusEmployeeRow[];
  totalRows: number;
  page: number;
  hasActiveFilters: boolean;
  idPeriod: number;
  /** Parámetros de URL vigentes (sin `pagina`), para conservar los filtros y el bono al paginar. */
  currentSearchParams: Record<string, string>;
}

const BADGE_BASE = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border";

const RESULT_BADGES: Record<BonusResult, { label: string; classes: string }> = {
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

export default function AttendanceBonusEmployeesTable({
  rows,
  totalRows,
  page,
  hasActiveFilters,
  idPeriod,
  currentSearchParams,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(totalRows / ATTENDANCE_BONUS_PAGE_SIZE));
  const firstShown = totalRows === 0 ? 0 : (page - 1) * ATTENDANCE_BONUS_PAGE_SIZE + 1;
  const lastShown = (page - 1) * ATTENDANCE_BONUS_PAGE_SIZE + rows.length;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">Bono de asistencia por podólogo</caption>
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold">Empleado</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Faltas</th>
              <th scope="col" className="px-4 py-3 font-semibold">Resultado</th>
              <th scope="col" className="px-6 py-3 font-semibold text-right">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-[#747780] dark:text-zinc-500">
                  {hasActiveFilters
                    ? "Ningún podólogo coincide con los filtros."
                    : "Este periodo no tiene podólogos con control de faltas."}
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
                      {/* El conteo lleva a Faltas, donde se justifica; un cero no tiene nada que revisar. */}
                      {employeeRow.absenceCount === 0 ? (
                        <span className="text-[#44474f] dark:text-zinc-300">0</span>
                      ) : (
                        <Link
                          href={buildIncidentScreenHref("/dashboard/nomina/faltas", idPeriod, employeeRow.nombre_completo)}
                          aria-label={`Ver faltas de ${employeeRow.nombre_completo}`}
                          className={COUNT_LINK_CLASSES}
                        >
                          {employeeRow.absenceCount}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`${BADGE_BASE} ${resultBadge.classes}`}>{resultBadge.label}</span>
                        {employeeRow.skipReason && (
                          <span className="text-xs text-[#44474f] dark:text-zinc-400">
                            {describeAttendanceBonusSkipReason(employeeRow.skipReason)}
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
