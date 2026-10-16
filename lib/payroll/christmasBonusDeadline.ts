import type { ChristmasBonusDeadlineState } from "@/interfaces/payroll_christmas_bonus";
import {
  CHRISTMAS_BONUS_DEADLINE_MONTH_DAY,
  CHRISTMAS_BONUS_WARNING_START_MONTH_DAY,
} from "@/lib/payroll/constants";

/**
 * Estado del aviso del 20 de diciembre. `today` es "YYYY-MM-DD" (Ciudad de México).
 * - "none": antes del 1-dic o la sucursal ya creó el periodo E del año.
 * - "upcoming": del 1-dic al 20-dic sin periodo E.
 * - "overdue": del 21-dic en adelante sin periodo E.
 */
export function getChristmasBonusDeadlineState(
  today: string,
  hasExtraordinaryPeriod: boolean,
): ChristmasBonusDeadlineState {
  if (hasExtraordinaryPeriod) return "none";
  const monthDay = today.slice(5, 10);
  if (monthDay < CHRISTMAS_BONUS_WARNING_START_MONTH_DAY) return "none";
  return monthDay <= CHRISTMAS_BONUS_DEADLINE_MONTH_DAY ? "upcoming" : "overdue";
}
