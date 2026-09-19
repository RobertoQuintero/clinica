import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { IPayrollPeriodRow } from "@/interfaces/payroll_period";
import { PAYROLL_PERIODS_PAGE_SIZE } from "@/lib/payroll/constants";
import { formatPeriodDate, formatPeriodRange } from "@/lib/payroll/periodFormat";
import DeletePayrollPeriodButton from "./DeletePayrollPeriodButton";
import { PayrollFrequencyBadge, PayrollStatusBadge } from "./PayrollBadges";
import { EditPayrollPeriodButton } from "./PayrollPeriodActions";

interface Props {
  rows: IPayrollPeriodRow[];
  totalRows: number;
  page: number;
  ejercicio: number;
  /** Parámetros de URL vigentes (sin `pagina`), para conservar los filtros al paginar. */
  currentSearchParams: Record<string, string>;
}

function buildPageHref(currentSearchParams: Record<string, string>, page: number): string {
  const searchParams = new URLSearchParams(currentSearchParams);
  if (page > 1) searchParams.set("pagina", String(page));
  else searchParams.delete("pagina");
  const query = searchParams.toString();
  return query ? `/dashboard/nomina/periodos?${query}` : "/dashboard/nomina/periodos";
}

const PAGER_BUTTON =
  "p-1.5 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 text-[#44474f] dark:text-zinc-300 transition-colors";

export default function PayrollPeriodsTable({ rows, totalRows, page, ejercicio, currentSearchParams }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalRows / PAYROLL_PERIODS_PAGE_SIZE));
  const firstShown = totalRows === 0 ? 0 : (page - 1) * PAYROLL_PERIODS_PAGE_SIZE + 1;
  const lastShown = (page - 1) * PAYROLL_PERIODS_PAGE_SIZE + rows.length;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
            <tr>
              <th className="px-6 py-4 font-semibold">Código</th>
              <th className="px-6 py-4 font-semibold">Tipo</th>
              <th className="px-6 py-4 font-semibold">Rango</th>
              <th className="px-6 py-4 font-semibold">Corte</th>
              <th className="px-6 py-4 font-semibold">Fecha de pago</th>
              <th className="px-6 py-4 font-semibold">Estatus</th>
              <th className="px-6 py-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-[#747780] dark:text-zinc-500">
                  No hay periodos que coincidan con los filtros.
                </td>
              </tr>
            ) : (
              rows.map((period) => (
                <tr key={period.id_period} className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-[#0b1c30] dark:text-zinc-100 whitespace-nowrap">
                    {period.codigo}
                  </td>
                  <td className="px-6 py-4">
                    <PayrollFrequencyBadge description={period.frecuencia_descripcion} />
                  </td>
                  <td className="px-6 py-4 text-sm text-[#0b1c30] dark:text-zinc-200 whitespace-nowrap">
                    {formatPeriodRange(period.fecha_inicio, period.fecha_fin)}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#44474f] dark:text-zinc-400 whitespace-nowrap">
                    {formatPeriodDate(period.fecha_corte)}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 whitespace-nowrap">
                    {formatPeriodDate(period.fecha_pago)}
                  </td>
                  <td className="px-6 py-4">
                    <PayrollStatusBadge status={period.status} />
                  </td>
                  <td className="px-6 py-4">
                    {period.status === 1 && (
                      <div className="flex items-center justify-end gap-1">
                        <EditPayrollPeriodButton period={period} />
                        <DeletePayrollPeriodButton idPeriod={period.id_period} periodCode={period.codigo} />
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 px-6 py-3 bg-[#eff4ff] dark:bg-zinc-800 border-t border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
        <span>
          {totalRows === 0
            ? `Sin periodos en el ejercicio ${ejercicio}`
            : `Mostrando ${firstShown}–${lastShown} de ${totalRows} periodos del ejercicio ${ejercicio}`}
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
