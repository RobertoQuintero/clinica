import Link from "next/link";
import { Eye } from "lucide-react";
import type { IPayrollEmployeeRow, IPayrollProcessPage, PayrollType } from "@/interfaces/payroll_calculation";
import { PAYROLL_TYPE } from "@/lib/payroll/constants";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { buildPayrollEmployeeDetailHref } from "@/lib/payroll/processUrls";

interface Props {
  rows: IPayrollEmployeeRow[];
  idPeriod: number;
  payrollType: PayrollType;
  idPuesto: number | null;
  search: string;
  /** Totales de todo el tipo: no cambian con los filtros de puesto y búsqueda. */
  totals: IPayrollProcessPage["totals"];
  hasActiveFilters: boolean;
}

/** Importe de una comisión con su conteo ("3 consultas") como texto secundario; sin conteo si es 0. */
function CommissionAmountCell({ amount, countLabel }: { amount: number; countLabel: string | null }) {
  return (
    <td className="px-4 py-3.5 text-right tabular-nums">
      <span className="block text-sm text-[#0b1c30] dark:text-zinc-200">{formatPayrollCurrency(amount)}</span>
      {countLabel && <span className="block text-[11px] text-[#747780] dark:text-zinc-500">{countLabel}</span>}
    </td>
  );
}

function describeCount(count: number, singular: string, plural: string): string | null {
  if (count <= 0) return null;
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Piezas vendidas con hasta 4 decimales (productos split), sin ceros de más; null si no hay. */
function describePiecesSold(piecesSold: number): string | null {
  if (piecesSold <= 0) return null;
  return describeCount(Math.round(piecesSold * 10000) / 10000, "pieza", "piezas");
}

export default function PayrollEmployeesTable({
  rows,
  idPeriod,
  payrollType,
  idPuesto,
  search,
  totals,
  hasActiveFilters,
}: Props) {
  // El detalle conserva los filtros para "Regresar" y para Anterior / Siguiente.
  const detailFilters = { idPeriod, payrollType, idPuesto, search };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">Sueldos de la nómina {PAYROLL_TYPE[payrollType].label.toLowerCase()}</caption>
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold">Empleado</th>
              <th scope="col" className="px-4 py-3 font-semibold">Puesto</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Salario D.</th>
              <th scope="col" className="px-4 py-3 font-semibold text-center">Días</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Sueldo</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Com. consultas</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Com. onicomicosis</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Com. Ventas</th>
              <th scope="col" className="px-6 py-3 font-semibold text-right">Total percepciones</th>
              <th scope="col" className="w-12 pr-4 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-8 text-center text-sm text-[#747780] dark:text-zinc-500">
                  {hasActiveFilters
                    ? "Ningún empleado coincide con los filtros."
                    : "Ningún empleado tiene sueldo calculado en esta nómina."}
                </td>
              </tr>
            ) : (
              rows.map((employeeRow) => {
                const detailHref = buildPayrollEmployeeDetailHref(employeeRow.id_empleado, detailFilters);
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
                    <td className="px-4 py-3.5 text-sm text-right tabular-nums text-[#0b1c30] dark:text-zinc-200">
                      {formatPayrollCurrency(employeeRow.salario_diario)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-block min-w-9 px-2 py-0.5 rounded bg-[#e6eeff] dark:bg-zinc-800 text-xs font-medium text-[#44474f] dark:text-zinc-300 tabular-nums">
                        {employeeRow.dias} d
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-right tabular-nums text-[#0b1c30] dark:text-zinc-200">
                      {formatPayrollCurrency(employeeRow.importe_salario)}
                    </td>
                    <CommissionAmountCell
                      amount={employeeRow.importe_comision}
                      countLabel={describeCount(employeeRow.consultas_atendidas, "consulta", "consultas")}
                    />
                    <CommissionAmountCell
                      amount={employeeRow.importe_comision_tratamientos}
                      countLabel={describeCount(employeeRow.tratamientos_onicomicosis, "tratamiento", "tratamientos")}
                    />
                    <CommissionAmountCell
                      amount={employeeRow.importe_comision_productos}
                      countLabel={describePiecesSold(employeeRow.piezas_vendidas)}
                    />
                    <td className="px-6 py-3.5 text-sm text-right font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-50">
                      {formatPayrollCurrency(employeeRow.total_percepciones)}
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
                colSpan={4}
                className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#0b1c30] dark:text-zinc-100"
              >
                Total nómina {PAYROLL_TYPE[payrollType].label.toLowerCase()}
                <span className="ml-2 font-medium normal-case tracking-normal text-[#44474f] dark:text-zinc-400">
                  {totals.employees} {totals.employees === 1 ? "empleado" : "empleados"}
                  {hasActiveFilters && ` · mostrando ${rows.length}`}
                </span>
              </th>
              <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100">
                {formatPayrollCurrency(totals.importeSalario)}
              </td>
              <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100">
                {formatPayrollCurrency(totals.importeComision)}
              </td>
              <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100">
                {formatPayrollCurrency(totals.importeComisionTratamientos)}
              </td>
              <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100">
                {formatPayrollCurrency(totals.importeComisionProductos)}
              </td>
              <td className="px-6 py-4 text-right text-base font-bold tabular-nums text-[#0051d5] dark:text-blue-300">
                {formatPayrollCurrency(totals.totalPercepciones)}
              </td>
              <td aria-hidden />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
