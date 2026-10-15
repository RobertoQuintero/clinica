import type { IVacationEntitlement, IVacationPayrollPayment, VacationPremiumStatus } from "@/interfaces/vacation";
import { VACATION_PREMIUM_PERCENT } from "@/lib/payroll/constants";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

// El dinero va en centavos enteros para no arrastrar error de flotantes; el redondeo es mitad hacia arriba como el ROUND de SQL.
const CENTS_PER_PESO = 100;
const PERCENT_DENOMINATOR = 100;

/** Fecha en que la prima entra a nómina: el inicio del bloque o, sin bloque, la fecha de pago; null si no hay ninguna. */
export function getVacationPremiumEventDate(
  entitlement: Pick<IVacationEntitlement, "fecha_inicio" | "fecha_pago">,
): string | null {
  return entitlement.fecha_inicio ?? entitlement.fecha_pago ?? null;
}

/** ROUND(dias × salario × 25 / 100, 2): se multiplica todo antes de redondear. */
export function calculateVacationPremiumAmount(entitledDays: number, dailySalary: number): number {
  const dailySalaryCents = Math.round(dailySalary * CENTS_PER_PESO);
  const numerator = entitledDays * dailySalaryCents * VACATION_PREMIUM_PERCENT;
  const denominator = PERCENT_DENOMINATOR;
  return Math.floor((2 * numerator + denominator) / (2 * denominator)) / CENTS_PER_PESO;
}

/** ROUND(dias_pagados × salario, 2). */
export function calculatePaidVacationAmount(paidDays: number, dailySalary: number): number {
  const dailySalaryCents = Math.round(dailySalary * CENTS_PER_PESO);
  return (paidDays * dailySalaryCents) / CENTS_PER_PESO;
}

/** "Prima $945.12 · 4 días $1,260.16": solo las partes con importe; null si no hay prima ni días pagados. */
export function describeVacationPaySplit(premiumAmount: number, paidDays: number, paidAmount: number): string | null {
  const parts = [
    premiumAmount > 0 ? `Prima ${formatPayrollCurrency(premiumAmount)}` : null,
    paidDays > 0 ? `${paidDays} ${paidDays === 1 ? "día" : "días"} ${formatPayrollCurrency(paidAmount)}` : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** "pagada" si algún periodo ya pagó la prima, "pendiente" si ya tiene fecha de evento y nadie la pagó, "sin_evento" si no. */
export function getVacationPremiumStatus(
  entitlement: Pick<IVacationEntitlement, "fecha_inicio" | "fecha_pago">,
  payments: IVacationPayrollPayment[],
): VacationPremiumStatus {
  if (getVacationPremiumEventDate(entitlement) === null) return "sin_evento";
  return payments.some((payment) => payment.concepto === "P") ? "pagada" : "pendiente";
}
