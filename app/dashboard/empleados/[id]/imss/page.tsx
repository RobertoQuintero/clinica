import { notFound } from "next/navigation";
import ManualHelpLink from "@/app/dashboard/componentes/ManualHelpLink";
import { EMPLOYEE_SETUP_ANCHORS, PAYROLL_MANUAL_TOPICS } from "@/lib/manual/links";
import { getEmployeeById } from "@/app/dashboard/empleados/actions";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { formatPeriodDate } from "@/lib/payroll/periodFormat";
import { addZeroToday } from "@/utils/date_helpper";
import { getEmployeeSbcHistory, getEmployeeSbcLog, getMinimumWageParameters } from "./actions";
import DeleteEmployeeSbcButton from "./componentes/DeleteEmployeeSbcButton";
import { EditEmployeeSbcButton, NewEmployeeSbcButton } from "./componentes/EmployeeSbcModal";
import EmployeeSbcHistory from "./componentes/EmployeeSbcHistory";
import EmployeeSbcLog from "./componentes/EmployeeSbcLog";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EmployeeImssPage({ params }: Props) {
  const { id } = await params;
  const id_empleado = Number(id);
  if (!Number.isInteger(id_empleado) || id_empleado <= 0) notFound();

  const employee = await getEmployeeById(id_empleado);
  if (!employee) notFound();

  const [historyResult, logResult, minimumWageResult] = await Promise.all([
    getEmployeeSbcHistory(id_empleado),
    getEmployeeSbcLog(id_empleado),
    getMinimumWageParameters(),
  ]);

  if (!historyResult.ok) {
    return (
      <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
        {historyResult.message}
      </p>
    );
  }

  const history = historyResult.data;
  const logEntries = logResult.ok ? logResult.data : [];
  const minimumWageRows = minimumWageResult.ok ? minimumWageResult.data : [];

  // El historial viene de más reciente a más antiguo: el vigente hoy es el primero que ya empezó.
  const today = addZeroToday(new Date());
  const currentSbc = history.find((employeeSbc) => employeeSbc.vigente_desde <= today) ?? null;

  const modalProps = {
    id_empleado,
    employeeName: employee.nombre_completo,
    hireDate: employee.fecha_ingreso.slice(0, 10),
    currentFiscalDailySalary: employee.salario_diario_fiscal,
    minimumWageRows,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">IMSS</h2>
            <ManualHelpLink
              moduleSlug="nomina"
              topicSlug={PAYROLL_MANUAL_TOPICS.employeeSetup}
              anchor={EMPLOYEE_SETUP_ANCHORS.imss}
            />
          </div>
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            Salario base de cotización (SBC) con el que se calcula la cuota obrera. Captura el mismo que se reportó en IDSE.
          </p>
        </div>
        {employee.activo && (
          <div className="sm:ml-auto">
            <NewEmployeeSbcButton {...modalProps} />
          </div>
        )}
      </div>

      <section
        aria-label="SBC vigente hoy"
        className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-5 shadow-sm"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
          SBC vigente hoy
        </p>
        {currentSbc ? (
          <p className="mt-1 text-3xl font-bold tabular-nums text-[#0b1c30] dark:text-zinc-50">
            {formatPayrollCurrency(currentSbc.sbc)}
            <span className="ml-3 text-sm font-medium text-[#44474f] dark:text-zinc-400">
              desde {formatPeriodDate(currentSbc.vigente_desde)}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-[#44474f] dark:text-zinc-400">Sin SBC vigente.</p>
        )}
      </section>

      <EmployeeSbcHistory
        history={history}
        currentIdEmployeeSbc={currentSbc?.id_employee_sbc ?? null}
        renderRowActions={
          employee.activo
            ? (employeeSbc) => (
                <>
                  <EditEmployeeSbcButton {...modalProps} editedSbc={employeeSbc} />
                  <DeleteEmployeeSbcButton
                    id_empleado={id_empleado}
                    id_employee_sbc={employeeSbc.id_employee_sbc}
                    effectiveDateLabel={formatPeriodDate(employeeSbc.vigente_desde)}
                  />
                </>
              )
            : undefined
        }
      />

      <EmployeeSbcLog entries={logEntries} />
    </div>
  );
}
