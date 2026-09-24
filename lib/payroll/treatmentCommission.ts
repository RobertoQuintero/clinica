import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

export interface ITreatmentPartialPayment {
  id_tratamiento_pago: number;
  created_at:          string;   // "YYYY-MM-DD HH:mm:ss"
  total:               number;
}

/**
 * Pago con el que la suma acumulada (orden created_at, id) alcanza el umbral, o null.
 * Recibe solo parciales tipo 2 con status 1. Restata en TS la regla que vive en el SQL del cálculo;
 * si divergen, manda el SQL.
 */
export function findLiquidationPayment(
  partialPayments: ITreatmentPartialPayment[],
  threshold: number,
): ITreatmentPartialPayment | null {
  // Strings "YYYY-MM-DD HH:mm:ss": la comparación léxica equivale a la cronológica, sin pasar por `Date`.
  const orderedPayments = [...partialPayments].sort((first, second) => {
    if (first.created_at !== second.created_at) return first.created_at < second.created_at ? -1 : 1;
    return first.id_tratamiento_pago - second.id_tratamiento_pago;
  });

  let cumulativeTotalInCents = 0;
  const thresholdInCents = Math.round(threshold * 100);
  for (const payment of orderedPayments) {
    cumulativeTotalInCents += Math.round(payment.total * 100);
    if (cumulativeTotalInCents >= thresholdInCents) return payment;
  }
  return null;
}

/** round(treatmentCount × unitAmount, 2). */
export function calculateTreatmentCommissionAmount(treatmentCount: number, unitAmount: number): number {
  return Math.round(treatmentCount * unitAmount * 100) / 100;
}

/** "3 tratamientos × $500.00" — descripción de la línea del detalle. */
export function describeTreatmentCommission(treatmentCount: number, unitAmount: number): string {
  const treatmentLabel = treatmentCount === 1 ? "tratamiento" : "tratamientos";
  return `${treatmentCount} ${treatmentLabel} × ${formatPayrollCurrency(unitAmount)}`;
}
