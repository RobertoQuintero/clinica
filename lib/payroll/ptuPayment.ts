import type { IPtuPaymentBreakdown } from "@/interfaces/payroll_ptu";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

export interface IPtuPaymentDescription {
  formula: string;          // "Por días $16,666.66 + por salario $17,857.14 = $34,523.80"
  capNote: string | null;   // "Topada a $27,000.00 (tope de 3 meses)"; null si no hubo tope
}

/**
 * Texto del Detalle de la PTU pagada (spec 90). Los importes salen del desglose congelado del reparto. Hubo tope cuando
 * `ptu_final < ptu_bruto`; el tope aplicado es el mayor entre el de 3 meses y el promedio de los ejercicios anteriores,
 * igual que en el cálculo del reparto (spec 89).
 */
export function describePtuPayment(ptu: IPtuPaymentBreakdown): IPtuPaymentDescription {
  const formula = `Por días ${formatPayrollCurrency(ptu.ptu_dias)} + por salario ${formatPayrollCurrency(ptu.ptu_salario)} = ${formatPayrollCurrency(ptu.ptu_bruto)}`;
  if (ptu.ptu_final >= ptu.ptu_bruto) return { formula, capNote: null };

  const averageWasHigher = ptu.promedio_tres_anios !== null && ptu.promedio_tres_anios > ptu.tope_tres_meses;
  const years = ptu.anios_promedio ?? 0;
  const capSource = averageWasHigher
    ? `promedio de ${years} ${years === 1 ? "año" : "años"}`
    : "tope de 3 meses";
  return { formula, capNote: `Topada a ${formatPayrollCurrency(ptu.ptu_final)} (${capSource})` };
}
