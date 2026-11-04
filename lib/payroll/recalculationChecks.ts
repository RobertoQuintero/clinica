import "server-only";

import { IPayrollMissingEmployee } from "@/interfaces/payroll_calculation";
import { IPayrollPeriodRow } from "@/interfaces/payroll_period";
import { isAbsenceRecalculationNeeded } from "@/lib/payroll/absenceRecalculation";
import { isAttendanceBonusRecalculationNeeded } from "@/lib/payroll/attendanceBonusRecalculation";
import { isExemptionRecalculationNeeded } from "@/lib/payroll/exemptionRecalculation";
import { isExtraordinaryRecalculationNeeded } from "@/lib/payroll/extraordinaryRecalculation";
import { isImssRecalculationNeeded } from "@/lib/payroll/imssRecalculation";
import { isIsrRecalculationNeeded } from "@/lib/payroll/isrRecalculation";
import { isLatenessRecalculationNeeded } from "@/lib/payroll/latenessRecalculation";
import { loadMissingEligibleEmployees } from "@/lib/payroll/missingEmployeesRecalculation";
import { isOvertimeRecalculationNeeded } from "@/lib/payroll/overtimeRecalculation";
import { isPendingDaysRecalculationNeeded } from "@/lib/payroll/pendingDaysRecalculation";
import { isPunctualityBonusRecalculationNeeded } from "@/lib/payroll/punctualityBonusRecalculation";
import { isShiftExtensionBonusRecalculationNeeded } from "@/lib/payroll/shiftExtensionBonusRecalculation";
import { isVacationPayRecalculationNeeded } from "@/lib/payroll/vacationPayRecalculation";

export interface IRecalculationFlags {
  overtimeRecalculationNeeded: boolean;
  absenceRecalculationNeeded: boolean;
  latenessRecalculationNeeded: boolean;
  punctualityBonusRecalculationNeeded: boolean;
  attendanceBonusRecalculationNeeded: boolean;
  shiftExtensionBonusRecalculationNeeded: boolean;
  isrRecalculationNeeded: boolean;
  imssRecalculationNeeded: boolean;
  exemptionRecalculationNeeded: boolean;
  vacationPayRecalculationNeeded: boolean;
  extraordinaryRecalculationNeeded: boolean;
  pendingDaysRecalculationNeeded: boolean;   // spec 97
  missingEligibleEmployees: IPayrollMissingEmployee[];   // spec 96; vacío = nada que recalcular
}

type PeriodForRecalculationChecks = Pick<
  IPayrollPeriodRow,
  "id_period" | "id_sucursal" | "id_payment_period" | "fecha_fin" | "tipo_periodo" | "concepto_extraordinario"
>;

/**
 * Las trece comprobaciones de "Recalcula", en una sola copia (specs 94, 96 y 97). Un periodo extraordinario
 * no tiene horas extra, faltas, retardos, bonos, ISR de la spec 70, vacaciones ni días pendientes; esos
 * avisos compararían contra un cálculo que nunca los incluyó. El del exento sí le aplica a ambos tipos, y
 * el de empleados faltantes aplica a ordinarios y aguinaldo (no a PTU, que `loadMissingEligibleEmployees`
 * ya descarta).
 */
export async function collectRecalculationFlags(period: PeriodForRecalculationChecks): Promise<IRecalculationFlags> {
  const isOrdinaryPeriod = period.tipo_periodo === "O";

  const [
    overtimeRecalculationNeeded,
    absenceRecalculationNeeded,
    latenessRecalculationNeeded,
    punctualityBonusRecalculationNeeded,
    attendanceBonusRecalculationNeeded,
    shiftExtensionBonusRecalculationNeeded,
    isrRecalculationNeeded,
    imssRecalculationNeeded,
    exemptionRecalculationNeeded,
    vacationPayRecalculationNeeded,
    extraordinaryRecalculationNeeded,
    pendingDaysRecalculationNeeded,
    missingEligibleEmployees,
  ] = await Promise.all([
    isOrdinaryPeriod ? isOvertimeRecalculationNeeded(period.id_period) : false,
    isOrdinaryPeriod ? isAbsenceRecalculationNeeded(period.id_period) : false,
    isOrdinaryPeriod ? isLatenessRecalculationNeeded(period.id_period) : false,
    isOrdinaryPeriod ? isPunctualityBonusRecalculationNeeded(period.id_period) : false,
    isOrdinaryPeriod ? isAttendanceBonusRecalculationNeeded(period.id_period) : false,
    isOrdinaryPeriod ? isShiftExtensionBonusRecalculationNeeded(period.id_period) : false,
    isOrdinaryPeriod ? isIsrRecalculationNeeded(period.id_period) : false,
    isOrdinaryPeriod ? isImssRecalculationNeeded(period.id_period) : false,
    isExemptionRecalculationNeeded(period.id_period),
    isOrdinaryPeriod ? isVacationPayRecalculationNeeded(period.id_period) : false,
    isOrdinaryPeriod ? false : isExtraordinaryRecalculationNeeded(period.id_period),
    isOrdinaryPeriod ? isPendingDaysRecalculationNeeded(period.id_period) : false,
    loadMissingEligibleEmployees(period),
  ]);

  return {
    overtimeRecalculationNeeded,
    absenceRecalculationNeeded,
    latenessRecalculationNeeded,
    punctualityBonusRecalculationNeeded,
    attendanceBonusRecalculationNeeded,
    shiftExtensionBonusRecalculationNeeded,
    isrRecalculationNeeded,
    imssRecalculationNeeded,
    exemptionRecalculationNeeded,
    vacationPayRecalculationNeeded,
    extraordinaryRecalculationNeeded,
    pendingDaysRecalculationNeeded,
    missingEligibleEmployees,
  };
}

/** `IRecalculationFlags.recalculationNeeded`-equivalente: el `or` de las trece banderas (spec 97). */
export function isAnyRecalculationFlagActive(flags: IRecalculationFlags): boolean {
  const { missingEligibleEmployees, ...booleanFlags } = flags;
  return Object.values(booleanFlags).some(Boolean) || missingEligibleEmployees.length > 0;
}
