import type { IVacationEntitlementView } from "@/interfaces/vacation";
import { describePayrollPeriodCodes } from "@/lib/payroll/vacationPay";

interface Props {
  entitlement: IVacationEntitlementView;
}

/**
 * Estatus de nómina de un año de derecho (spec 78), solo lectura:
 * "Prima: Pagada en {código}" | "Pendiente" | "—" y, si hay pago de días, "Días: Pagados en {código}" |
 * "Marcados, sin nómina calculada". Si la operativa y la fiscal cayeron en periodos distintos, salen ambos códigos.
 */
export default function VacationPayrollStatus({ entitlement }: Props) {
  const premiumCodes = describePayrollPeriodCodes(entitlement.payroll_payments, "P");
  const paidDaysCodes = describePayrollPeriodCodes(entitlement.payroll_payments, "D");
  const hasPaidDays = entitlement.fecha_pago !== null;

  return (
    <ul className="flex flex-col gap-0.5 text-sm text-[#44474f] dark:text-zinc-300">
      <li>
        <span className="text-[#74777f] dark:text-zinc-500">Prima: </span>
        {entitlement.premium_status === "pagada" ? (
          <span className="font-semibold text-emerald-700 dark:text-emerald-300">
            Pagada en {premiumCodes}
          </span>
        ) : entitlement.premium_status === "pendiente" ? (
          <span className="font-semibold text-amber-700 dark:text-amber-300">Pendiente</span>
        ) : (
          <span className="text-[#74777f] dark:text-zinc-500">—</span>
        )}
      </li>
      {hasPaidDays && (
        <li>
          <span className="text-[#74777f] dark:text-zinc-500">Días: </span>
          {entitlement.paid_days_in_payroll ? (
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
              Pagados en {paidDaysCodes}
            </span>
          ) : (
            <span className="font-semibold text-amber-700 dark:text-amber-300">
              Marcados, sin nómina calculada
            </span>
          )}
        </li>
      )}
    </ul>
  );
}
