import type { ReactNode } from "react";
import { BadgeCheck, Briefcase, CalendarCheck2, CalendarRange, Wallet } from "lucide-react";
import type { IPayrollEmployeeDetail, PayrollType } from "@/interfaces/payroll_calculation";
import { PAYROLL_TYPE } from "@/lib/payroll/constants";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { formatPeriodDate, formatPeriodRange } from "@/lib/payroll/periodFormat";
import EmployeeAvatar from "@/app/dashboard/empleados/componentes/EmployeeAvatar";
import EmployeeStatusBadge from "@/app/dashboard/empleados/componentes/EmployeeStatusBadge";

interface Props {
  employee: IPayrollEmployeeDetail["employee"];
  period: IPayrollEmployeeDetail["period"];
  salarioDiario: number | null;   // null: el empleado no está en la nómina del tipo seleccionado
  payrollType: PayrollType;
}

function PayrollMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col px-3 py-1 min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 tabular-nums whitespace-nowrap">
        <span aria-hidden className="text-[#0051d5] dark:text-blue-300">{icon}</span>
        {value}
      </dd>
    </div>
  );
}

export default function PayrollEmployeeProfileCard({ employee, period, salarioDiario, payrollType }: Props) {
  return (
    <section
      aria-label="Empleado"
      className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-5 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-5"
    >
      <div className="flex items-center gap-4 min-w-0">
        <EmployeeAvatar
          fotoUrl={employee.foto_url}
          nombreCompleto={employee.nombre_completo}
          sizeClassName="w-16 h-16 text-lg"
        />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-xl font-bold tracking-tight text-[#0b1c30] dark:text-zinc-50">
              {employee.nombre_completo}
            </h3>
            <EmployeeStatusBadge activo={employee.activo} />
          </div>
          <div className="mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap text-sm text-[#44474f] dark:text-zinc-400">
            <span className="flex items-center gap-1 font-medium text-[#0b1c30] dark:text-zinc-200">
              <BadgeCheck size={15} aria-hidden className="text-[#0051d5] dark:text-blue-300" />
              {employee.codigo_empleado}
            </span>
            {employee.nombre_puesto && (
              <>
                <span aria-hidden>•</span>
                <span className="flex items-center gap-1">
                  <Briefcase size={15} aria-hidden />
                  {employee.nombre_puesto}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#f8f9ff] dark:bg-zinc-800/60 border border-[#e5e8f0] dark:border-zinc-700 p-2 rounded-lg shrink-0">
        <PayrollMetric
          icon={<Wallet size={16} />}
          label={`Salario diario ${PAYROLL_TYPE[payrollType].label.toLowerCase()}`}
          value={salarioDiario === null ? "—" : formatPayrollCurrency(salarioDiario)}
        />
        <PayrollMetric
          icon={<CalendarRange size={16} />}
          label="Periodo de pago"
          value={formatPeriodRange(period.fecha_inicio, period.fecha_fin)}
        />
        <PayrollMetric
          icon={<CalendarCheck2 size={16} />}
          label="Fecha de pago"
          value={formatPeriodDate(period.fecha_pago)}
        />
      </dl>
    </section>
  );
}
