import type { ReactNode } from "react";
import { Banknote, CalendarCheck2, CalendarRange, UsersRound } from "lucide-react";
import type { IPayrollPeriodRow } from "@/interfaces/payroll_period";
import type { IPayrollProcessPage, PayrollType } from "@/interfaces/payroll_calculation";
import { PAYROLL_TYPE } from "@/lib/payroll/constants";
import { formatCalculatedAt, formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { daysFromTo, formatPeriodDate, formatPeriodRange } from "@/lib/payroll/periodFormat";
import { PayrollFrequencyBadge } from "../../periodos/componentes/PayrollBadges";

interface Props {
  period: IPayrollPeriodRow;
  payrollType: PayrollType;
  totals: IPayrollProcessPage["totals"];
  lastCalculatedAt: string | null;
  today: string;
}

function describePaymentDistance(paymentDate: string, today: string): string {
  const daysUntilPayment = daysFromTo(today, paymentDate);
  if (daysUntilPayment === 0) return "Hoy";
  if (daysUntilPayment === 1) return "Mañana";
  if (daysUntilPayment > 1) return `En ${daysUntilPayment} días`;
  if (daysUntilPayment === -1) return "Ayer";
  return `Hace ${Math.abs(daysUntilPayment)} días`;
}

function SummaryCard({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-4 shadow-sm flex items-center gap-3 min-w-0">
      <span className="w-10 h-10 shrink-0 rounded-xl bg-[#dce9ff] dark:bg-zinc-800 text-[#0051d5] dark:text-blue-300 flex items-center justify-center">
        {icon}
      </span>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
          {label}
        </span>
        {children}
      </div>
    </div>
  );
}

export default function PayrollProcessSummaryCards({ period, payrollType, totals, lastCalculatedAt, today }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <SummaryCard icon={<CalendarRange size={20} />} label="Periodo">
        <span className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50 truncate">
          {formatPeriodRange(period.fecha_inicio, period.fecha_fin)}
        </span>
        <span className="mt-1 flex items-center gap-2 text-xs text-[#44474f] dark:text-zinc-400">
          {period.codigo}
          <PayrollFrequencyBadge description={period.frecuencia_descripcion} />
        </span>
      </SummaryCard>

      <SummaryCard icon={<CalendarCheck2 size={20} />} label="Fecha de pago">
        <span className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">
          {formatPeriodDate(period.fecha_pago)}
        </span>
        <span className="text-xs text-[#44474f] dark:text-zinc-400">
          {describePaymentDistance(period.fecha_pago, today)}
        </span>
      </SummaryCard>

      <SummaryCard icon={<UsersRound size={20} />} label="Empleados calculados">
        <span className="text-2xl font-bold leading-tight text-[#0b1c30] dark:text-zinc-50 tabular-nums">
          {totals.employees}
        </span>
        <span className="text-xs text-[#44474f] dark:text-zinc-400">
          Nómina {PAYROLL_TYPE[payrollType].label.toLowerCase()}
        </span>
      </SummaryCard>

      <SummaryCard icon={<Banknote size={20} />} label="Total de percepciones">
        <span className="text-xl font-bold leading-tight text-[#0b1c30] dark:text-zinc-50 tabular-nums">
          {formatPayrollCurrency(totals.totalPercepciones)}
        </span>
        <span className="text-xs text-[#44474f] dark:text-zinc-400 tabular-nums">
          Sueldos {formatPayrollCurrency(totals.importeSalario)} + comisión {formatPayrollCurrency(totals.importeComision)}
        </span>
        <span className="text-xs text-[#44474f] dark:text-zinc-400">
          {lastCalculatedAt
            ? `Calculado el ${formatCalculatedAt(lastCalculatedAt)}`
            : period.status === 1
              ? "Sin calcular"
              : "Ningún empleado elegible"}
        </span>
      </SummaryCard>
    </div>
  );
}
