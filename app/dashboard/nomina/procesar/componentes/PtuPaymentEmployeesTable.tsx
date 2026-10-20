import Link from "next/link";
import { Eye } from "lucide-react";
import type { IPayrollEmployeeRow, IPayrollProcessPage } from "@/interfaces/payroll_calculation";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { buildPayrollEmployeeDetailHref } from "@/lib/payroll/processUrls";
import { IsrAmountCell } from "./IsrAmountCell";
import { TaxAmountCell } from "./TaxAmountCell";

interface Props {
  rows: IPayrollEmployeeRow[];
  idPeriod: number;
  idPuesto: number | null;
  search: string;
  /** Totales de todo el periodo: no cambian con los filtros de puesto y búsqueda. */
  totals: IPayrollProcessPage["totals"];
  hasActiveFilters: boolean;
}

const COLUMN_COUNT = 11;
const FOOTER_AMOUNT_CLASSES = "px-4 py-4 text-right text-sm font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100";

/**
 * Tabla de Procesar para un periodo extraordinario de PTU (spec 90): siempre fiscal. Muestra el desglose del reparto
 * (días, PTU por días y por salario), la PTU pagada con la marca "Topado" cuando el tope la redujo, y lo gravado,
 * exento, el ISR del art. 174 y el neto.
 */
export default function PtuPaymentEmployeesTable({ rows, idPeriod, idPuesto, search, totals, hasActiveFilters }: Props) {
  const detailFilters = { idPeriod, payrollType: "F" as const, idPuesto, search };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="relative overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">PTU de la nómina fiscal</caption>
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold">Empleado</th>
              <th scope="col" className="px-4 py-3 font-semibold">Puesto</th>
              <th scope="col" className="px-4 py-3 font-semibold text-center">Días</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">PTU por días</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">PTU por salario</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">PTU</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Gravado</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Exento</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">ISR</th>
              <th scope="col" className="px-6 py-3 font-semibold text-right">Neto</th>
              <th scope="col" className="w-12 pr-4 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-6 py-8 text-center text-sm text-[#747780] dark:text-zinc-500">
                  {hasActiveFilters
                    ? "Ningún empleado coincide con los filtros."
                    : "Ningún empleado tiene PTU calculada en esta nómina."}
                </td>
              </tr>
            ) : (
              rows.map((employeeRow) => {
                const detailHref = buildPayrollEmployeeDetailHref(employeeRow.id_empleado, detailFilters);
                const breakdown = employeeRow.ptu;
                const wasCapped = breakdown !== null && breakdown.ptu_final < breakdown.ptu_bruto;
                return (
                  <tr
                    key={employeeRow.id_period_employee}
                    className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex flex-col min-w-0">
                        <Link
                          href={detailHref}
                          className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 truncate hover:text-[#0051d5] dark:hover:text-blue-400 hover:underline"
                        >
                          {employeeRow.nombre_completo}
                        </Link>
                        <span className="text-[11px] text-[#747780] dark:text-zinc-500">
                          {employeeRow.codigo_empleado}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#44474f] dark:text-zinc-300 whitespace-nowrap">
                      {employeeRow.nombre_puesto}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-block min-w-9 px-2 py-0.5 rounded bg-[#e6eeff] dark:bg-zinc-800 text-xs font-medium text-[#44474f] dark:text-zinc-300 tabular-nums">
                        {breakdown?.dias ?? 0} d
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-right tabular-nums text-[#0b1c30] dark:text-zinc-200">
                      {breakdown ? formatPayrollCurrency(breakdown.ptu_dias) : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-right tabular-nums text-[#0b1c30] dark:text-zinc-200">
                      {breakdown ? formatPayrollCurrency(breakdown.ptu_salario) : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-right font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-50 whitespace-nowrap">
                      {wasCapped && (
                        <span
                          className="mr-2 inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                          title={`El tope redujo la PTU de ${formatPayrollCurrency(breakdown.ptu_bruto)} a ${formatPayrollCurrency(breakdown.ptu_final)}`}
                        >
                          Topado
                        </span>
                      )}
                      {formatPayrollCurrency(employeeRow.importe_ptu)}
                    </td>
                    <TaxAmountCell amount={employeeRow.importe_gravado} />
                    <TaxAmountCell amount={employeeRow.importe_exento} />
                    <IsrAmountCell isrStatus={employeeRow.isr_estado} isrWithheld={employeeRow.isr_retenido} />
                    <td className="px-6 py-3.5 text-sm text-right font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-50">
                      {formatPayrollCurrency(employeeRow.neto)}
                    </td>
                    <td className="pr-4 py-3.5 text-right">
                      <Link
                        href={detailHref}
                        aria-label={`Ver detalle de ${employeeRow.nombre_completo}`}
                        title="Ver detalle"
                        className="inline-flex w-8 h-8 items-center justify-center rounded-lg text-[#44474f] dark:text-zinc-400 hover:bg-[#dce9ff] hover:text-[#0051d5] dark:hover:bg-zinc-800 dark:hover:text-blue-300 transition-colors"
                      >
                        <Eye size={17} aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="bg-[#dce9ff]/70 dark:bg-zinc-800 border-t-2 border-[#d3e4fe] dark:border-zinc-700">
              <th
                scope="row"
                colSpan={5}
                className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#0b1c30] dark:text-zinc-100"
              >
                Total PTU
                <span className="ml-2 font-medium normal-case tracking-normal text-[#44474f] dark:text-zinc-400">
                  {totals.employees} {totals.employees === 1 ? "empleado" : "empleados"}
                  {hasActiveFilters && ` · mostrando ${rows.length}`}
                </span>
              </th>
              <td className={FOOTER_AMOUNT_CLASSES}>{formatPayrollCurrency(totals.importePtu)}</td>
              <td className={FOOTER_AMOUNT_CLASSES}>{formatPayrollCurrency(totals.importeGravado)}</td>
              <td className={FOOTER_AMOUNT_CLASSES}>{formatPayrollCurrency(totals.importeExento)}</td>
              <td className={FOOTER_AMOUNT_CLASSES}>{formatPayrollCurrency(totals.importeIsr)}</td>
              <td className="px-6 py-4 text-right text-base font-bold tabular-nums text-[#0051d5] dark:text-blue-300">
                {formatPayrollCurrency(totals.totalNeto)}
              </td>
              <td aria-hidden />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
