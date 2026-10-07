import type { IShiftExtensionEmployeeRow } from "@/interfaces/payroll_shift_extension_bonus";
import { SHIFT_EXTENSION_BONUS_PAGE_SIZE } from "@/lib/payroll/constants";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import PayrollPagerFooter from "../../componentes/PayrollPagerFooter";
import ShiftExtensionAssignmentButton from "./ShiftExtensionAssignmentButton";

interface Props {
  rows: IShiftExtensionEmployeeRow[];
  totalRows: number;
  page: number;
  hasActiveFilters: boolean;
  /** Parámetros de URL vigentes (sin `pagina`), para conservar los filtros y el bono al paginar. */
  currentSearchParams: Record<string, string>;
}

const BADGE_BASE = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border";
const ASSIGNED_BADGE_CLASSES =
  "bg-[#009c6b]/10 text-[#009c6b] border-[#009c6b]/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
const UNASSIGNED_BADGE_CLASSES =
  "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";

export default function ShiftExtensionEmployeesTable({
  rows,
  totalRows,
  page,
  hasActiveFilters,
  currentSearchParams,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(totalRows / SHIFT_EXTENSION_BONUS_PAGE_SIZE));
  const firstShown = totalRows === 0 ? 0 : (page - 1) * SHIFT_EXTENSION_BONUS_PAGE_SIZE + 1;
  const lastShown = (page - 1) * SHIFT_EXTENSION_BONUS_PAGE_SIZE + rows.length;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">Bono por extensión de jornada por podólogo</caption>
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-xs uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold">Empleado</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Días con horario</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Días trabajados</th>
              <th scope="col" className="px-4 py-3 font-semibold">Bono</th>
              <th scope="col" className="px-6 py-3 font-semibold text-right">Importe estimado</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-[#747780] dark:text-zinc-500">
                  {hasActiveFilters
                    ? "Ningún podólogo coincide con los filtros."
                    : "Este periodo no tiene podólogos con control de faltas."}
                </td>
              </tr>
            ) : (
              rows.map((employeeRow) => (
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
                  <td className="px-4 py-3.5 text-sm text-right tabular-nums text-[#44474f] dark:text-zinc-300">
                    {employeeRow.scheduledDays}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-right tabular-nums font-semibold text-[#0b1c30] dark:text-zinc-100">
                    {employeeRow.workedDays}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`${BADGE_BASE} ${employeeRow.isAssigned ? ASSIGNED_BADGE_CLASSES : UNASSIGNED_BADGE_CLASSES}`}
                    >
                      {employeeRow.isAssigned ? "Asignado" : "Sin asignar"}
                    </span>
                  </td>
                  <td
                    className={`px-6 py-3.5 text-sm text-right tabular-nums font-semibold ${
                      employeeRow.isAssigned ? "text-[#0b1c30] dark:text-zinc-100" : "text-[#747780] dark:text-zinc-500"
                    }`}
                  >
                    {formatPayrollCurrency(employeeRow.estimatedAmount)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex justify-end">
                      <ShiftExtensionAssignmentButton
                        employeeId={employeeRow.id_empleado}
                        employeeName={employeeRow.nombre_completo}
                        isAssigned={employeeRow.isAssigned}
                      />
                    </div>
                  </td>
                </tr>
              ))
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
