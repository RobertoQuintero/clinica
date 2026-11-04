import type { IPendingDayPaymentRow } from "@/interfaces/payroll_pending_days";
import { PENDING_DAYS_PAGE_SIZE } from "@/lib/payroll/constants";
import { calculatePendingDayAmount } from "@/lib/payroll/pendingDaysPay";
import { formatDateTimeSlashed, formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { formatPeriodDate } from "@/lib/payroll/periodFormat";
import PayrollPagerFooter from "../../componentes/PayrollPagerFooter";
import DeletePendingDayPaymentButton from "./DeletePendingDayPaymentButton";

interface Props {
  rows: IPendingDayPaymentRow[];
  totalRows: number;
  page: number;
  hasActiveFilters: boolean;
  /** Periodo en estatus 1 o 2: solo entonces se muestra la columna de borrar. */
  canCapture: boolean;
  currentSearchParams: Record<string, string>;
}

const BADGE_BASE = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border";

const PAID_BADGE_CLASSES =
  "bg-[#009c6b]/10 text-[#009c6b] border-[#009c6b]/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";

const WARNING_BADGE_CLASSES =
  "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";

export default function PendingDayPaymentsTable({
  rows,
  totalRows,
  page,
  hasActiveFilters,
  canCapture,
  currentSearchParams,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(totalRows / PENDING_DAYS_PAGE_SIZE));
  const firstShown = totalRows === 0 ? 0 : (page - 1) * PENDING_DAYS_PAGE_SIZE + 1;
  const lastShown = (page - 1) * PENDING_DAYS_PAGE_SIZE + rows.length;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">Días pendientes de pago capturados en el periodo</caption>
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold">Empleado</th>
              <th scope="col" className="px-4 py-3 font-semibold">Fecha</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Tarifa O</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Tarifa F</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Importe est. O</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Importe est. F</th>
              <th scope="col" className="px-6 py-3 font-semibold">Motivo</th>
              <th scope="col" className="px-4 py-3 font-semibold">Autor</th>
              <th scope="col" className="px-4 py-3 font-semibold">Capturado</th>
              <th scope="col" className="px-4 py-3 font-semibold">Estado</th>
              {canCapture && (
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={canCapture ? 11 : 10} className="px-6 py-8 text-center text-sm text-[#747780] dark:text-zinc-500">
                  {hasActiveFilters
                    ? "Ninguna captura coincide con el buscador."
                    : "Este periodo todavía no tiene días pendientes capturados."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id_pending_day_payment}
                  className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-6 py-3.5">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 truncate">
                        {row.nombre_completo}
                      </span>
                      <span className="text-[11px] text-[#747780] dark:text-zinc-500">{row.codigo_empleado}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[#0b1c30] dark:text-zinc-200 whitespace-nowrap tabular-nums">
                    {formatPeriodDate(row.fecha)}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-right text-[#44474f] dark:text-zinc-300 whitespace-nowrap tabular-nums">
                    {formatPayrollCurrency(row.tarifa_operativa)}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-right text-[#44474f] dark:text-zinc-300 whitespace-nowrap tabular-nums">
                    {formatPayrollCurrency(row.tarifa_fiscal)}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-right font-semibold text-[#0b1c30] dark:text-zinc-100 whitespace-nowrap tabular-nums">
                    {formatPayrollCurrency(calculatePendingDayAmount(row.tarifa_operativa))}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-right font-semibold text-[#0b1c30] dark:text-zinc-100 whitespace-nowrap tabular-nums">
                    {formatPayrollCurrency(calculatePendingDayAmount(row.tarifa_fiscal))}
                  </td>
                  <td className="px-6 py-3.5 text-sm text-[#44474f] dark:text-zinc-300 max-w-72">
                    <span className="block line-clamp-2">{row.motivo}</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[#44474f] dark:text-zinc-300 whitespace-nowrap">
                    {row.capturado_por || "—"}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-[#44474f] dark:text-zinc-300 whitespace-nowrap tabular-nums">
                    {formatDateTimeSlashed(row.created_at)}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col items-start gap-1">
                      {row.pagado_en && (
                        <span className={`${BADGE_BASE} ${PAID_BADGE_CLASSES}`}>Pagado en {row.pagado_en}</span>
                      )}
                      {(row.sin_salario_operativa || row.sin_salario_fiscal) && (
                        <span className={`${BADGE_BASE} ${WARNING_BADGE_CLASSES}`}>
                          Sin salario {row.sin_salario_operativa && row.sin_salario_fiscal ? "O y F" : row.sin_salario_operativa ? "O" : "F"}
                        </span>
                      )}
                      {!row.pagado_en && !row.sin_salario_operativa && !row.sin_salario_fiscal && (
                        <span className="text-xs text-[#747780] dark:text-zinc-500">—</span>
                      )}
                    </div>
                  </td>
                  {canCapture && (
                    <td className="pr-4 py-3.5">
                      <div className="flex justify-end">
                        <DeletePendingDayPaymentButton
                          idPendingDayPayment={row.id_pending_day_payment}
                          idPeriod={row.id_period}
                          employeeName={row.nombre_completo}
                          fecha={formatPeriodDate(row.fecha)}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PayrollPagerFooter
        basePath="/dashboard/nomina/dias-pendientes"
        currentSearchParams={currentSearchParams}
        page={page}
        totalPages={totalPages}
        summaryText={
          totalRows === 0
            ? "Sin capturas para mostrar"
            : `Mostrando ${firstShown}–${lastShown} de ${totalRows} ${totalRows === 1 ? "captura" : "capturas"}`
        }
      />
    </div>
  );
}
