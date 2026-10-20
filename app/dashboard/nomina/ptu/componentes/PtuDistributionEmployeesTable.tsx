import type { IPtuDistributionEmployee } from "@/interfaces/payroll_ptu";
import { PTU_CATEGORY_SHORT_LABELS, PTU_INELIGIBILITY_REASON_LABELS } from "@/lib/payroll/constants";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { EditPtuEmployeeButton } from "./PtuEmployeeActions";
import RemovePtuEmployeeButton from "./RemovePtuEmployeeButton";

interface Props {
  idPtuDistribution: number;
  employees: IPtuDistributionEmployee[];
  fiscalYear: number;
  /** Solo un reparto en borrador se edita. */
  isEditable: boolean;
}

const HEADER_CELL = "px-4 py-3 font-semibold whitespace-nowrap";
const NUMBER_CELL = "px-4 py-3 text-sm text-right tabular-nums whitespace-nowrap";
const TAG = "ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold align-middle";

function formatMoneyOrDash(amount: number | null): string {
  return amount === null ? "—" : formatPayrollCurrency(amount);
}

export default function PtuDistributionEmployeesTable({ idPtuDistribution, employees, fiscalYear, isEditable }: Props) {
  const columnCount = isEditable ? 14 : 13;
  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1280px] text-left border-collapse">
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
            <tr>
              <th className={HEADER_CELL}>Nombre</th>
              <th className={HEADER_CELL}>Sucursal</th>
              <th className={HEADER_CELL}>Categoría</th>
              <th className={`${HEADER_CELL} text-right`}>Días</th>
              <th className={`${HEADER_CELL} text-right`}>Salario</th>
              <th className={`${HEADER_CELL} text-right`}>Salario de reparto</th>
              <th className={`${HEADER_CELL} text-right`}>PTU días</th>
              <th className={`${HEADER_CELL} text-right`}>PTU salario</th>
              <th className={`${HEADER_CELL} text-right`}>Bruto</th>
              <th className={`${HEADER_CELL} text-right`}>Tope 3 meses</th>
              <th className={`${HEADER_CELL} text-right`}>Promedio 3 años</th>
              <th className={`${HEADER_CELL} text-right`}>PTU final</th>
              <th className={HEADER_CELL}>Motivo</th>
              {isEditable && <th className={`${HEADER_CELL} text-right`}>Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-6 py-10 text-center text-[#747780] dark:text-zinc-500">
                  Todavía no hay trabajadores. «Precargar trabajadores» trae a quienes tienen nómina fiscal ordinaria
                  con fecha de fin en {fiscalYear}.
                </td>
              </tr>
            ) : (
              employees.map((employee) => (
                <tr
                  key={employee.id_ptu_distribution_employee}
                  className={`hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors ${
                    employee.elegible ? "" : "text-[#747780] dark:text-zinc-500"
                  }`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`font-semibold ${employee.elegible ? "text-[#0b1c30] dark:text-zinc-100" : ""}`}>
                      {employee.nombre_completo}
                    </span>
                    <span className="ml-2 text-xs tabular-nums text-[#747780] dark:text-zinc-500">
                      {employee.codigo_empleado}
                    </span>
                    {employee.editado && (
                      <span
                        title="Se editó a mano: la precarga ya no la modifica"
                        className={`${TAG} border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300`}
                      >
                        Editado
                      </span>
                    )}
                    {employee.origen === "M" && (
                      <span
                        title="Agregado a mano, sin nómina fiscal en el ejercicio"
                        className={`${TAG} border-[#c4c6d0] bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300`}
                      >
                        A mano
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">{employee.nombre_sucursal}</td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">{PTU_CATEGORY_SHORT_LABELS[employee.categoria_ptu]}</td>
                  <td className={NUMBER_CELL}>{employee.dias}</td>
                  <td className={NUMBER_CELL}>{formatPayrollCurrency(employee.salario)}</td>
                  <td className={NUMBER_CELL}>{formatMoneyOrDash(employee.salario_reparto)}</td>
                  <td className={NUMBER_CELL}>{formatMoneyOrDash(employee.ptu_dias)}</td>
                  <td className={NUMBER_CELL}>{formatMoneyOrDash(employee.ptu_salario)}</td>
                  <td className={NUMBER_CELL}>{formatMoneyOrDash(employee.ptu_bruto)}</td>
                  <td className={NUMBER_CELL}>{formatMoneyOrDash(employee.tope_tres_meses)}</td>
                  <td className={NUMBER_CELL}>
                    {employee.promedio_tres_anios === null || employee.anios_promedio === null ? (
                      "—"
                    ) : (
                      <>
                        {formatPayrollCurrency(employee.promedio_tres_anios)}
                        <span className="block text-xs text-[#747780] dark:text-zinc-500">
                          {employee.anios_promedio === 1 ? "1 año" : `${employee.anios_promedio} años`}
                        </span>
                      </>
                    )}
                  </td>
                  <td
                    className={`${NUMBER_CELL} font-semibold ${
                      employee.elegible ? "text-[#0b1c30] dark:text-zinc-50" : ""
                    }`}
                  >
                    {formatPayrollCurrency(employee.ptu_final)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {employee.motivo ? PTU_INELIGIBILITY_REASON_LABELS[employee.motivo] : ""}
                  </td>
                  {isEditable && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <EditPtuEmployeeButton idPtuDistribution={idPtuDistribution} employee={employee} />
                        {employee.origen === "M" && (
                          <RemovePtuEmployeeButton
                            idPtuDistribution={idPtuDistribution}
                            idEmployee={employee.id_empleado}
                            employeeName={employee.nombre_completo}
                          />
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
