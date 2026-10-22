import "server-only";

import { IPayrollPeriodRow } from "@/interfaces/payroll_period";
import { isAbsenceRecalculationNeeded } from "@/lib/payroll/absenceRecalculation";
import { isAttendanceBonusRecalculationNeeded } from "@/lib/payroll/attendanceBonusRecalculation";
import { isExemptionRecalculationNeeded } from "@/lib/payroll/exemptionRecalculation";
import { isExtraordinaryRecalculationNeeded } from "@/lib/payroll/extraordinaryRecalculation";
import { isImssRecalculationNeeded } from "@/lib/payroll/imssRecalculation";
import { isIsrRecalculationNeeded } from "@/lib/payroll/isrRecalculation";
import { isLatenessRecalculationNeeded } from "@/lib/payroll/latenessRecalculation";
import { isOvertimeRecalculationNeeded } from "@/lib/payroll/overtimeRecalculation";
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
}

/**
 * Las once comprobaciones de "Recalcula", en una sola copia (spec 94). Un periodo extraordinario
 * no tiene horas extra, faltas, retardos, bonos, ISR de la spec 70 ni vacaciones; esos avisos
 * compararían contra un cálculo que nunca los incluyó. El del exento sí le aplica a ambos tipos.
 */
export async function collectRecalculationFlags(
  period: Pick<IPayrollPeriodRow, "id_period" | "tipo_periodo">,
): Promise<IRecalculationFlags> {
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
  };
}
