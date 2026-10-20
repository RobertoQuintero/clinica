import type { PtuPaymentDeadlineState, PtuTaxpayerType } from "@/interfaces/payroll_ptu";
import { PTU_PAYMENT_DEADLINE_MONTH_DAY, PTU_PAYMENT_WARNING_DAYS } from "@/lib/payroll/constants";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Suma días a un "YYYY-MM-DD" sin pasar por la zona horaria local (se calcula en UTC). */
function addDaysToDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * MILLISECONDS_PER_DAY);
  return shifted.toISOString().slice(0, 10);
}

/** Fecha límite para pagar la PTU del reparto de `paymentYear - 1`: "YYYY-MM-DD". */
export function getPtuPaymentDeadline(paymentYear: number, taxpayerType: PtuTaxpayerType): string {
  return `${paymentYear}-${PTU_PAYMENT_DEADLINE_MONTH_DAY[taxpayerType]}`;
}

/**
 * Estado del aviso de la fecha límite de la PTU. `today` y `deadline` son "YYYY-MM-DD" (Ciudad de México).
 * - "none": faltan más de 30 días o la sucursal ya creó su periodo PTU del año.
 * - "upcoming": desde 30 días antes de la fecha límite y hasta ella, sin periodo PTU.
 * - "overdue": desde el día siguiente a la fecha límite, sin periodo PTU.
 */
export function getPtuPaymentDeadlineState(
  today: string,
  deadline: string,
  hasPtuPeriod: boolean,
): PtuPaymentDeadlineState {
  if (hasPtuPeriod) return "none";
  if (today > deadline) return "overdue";
  return today >= addDaysToDateString(deadline, -PTU_PAYMENT_WARNING_DAYS) ? "upcoming" : "none";
}
