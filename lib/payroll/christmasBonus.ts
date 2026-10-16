import {
  CHRISTMAS_BONUS_DAYS,
  CHRISTMAS_BONUS_YEAR_DAYS,
} from "@/lib/payroll/constants";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { daysFromTo } from "@/lib/payroll/periodFormat";

const CENTS_PER_UNIT = 100;

/** Redondeo a entero, mitad hacia arriba, de `numerator / denominator` (enteros no negativos). */
function divideRoundingHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/**
 * Días laborados del año del periodo: `fechaFin − max(fechaInicio, fechaIngreso) + 1`.
 * Cuenta hasta el 31-dic aunque se calcule antes y no descuenta faltas. 0 si ingresó después de `fechaFin`.
 * Todas las fechas son "YYYY-MM-DD".
 */
export function countChristmasBonusDays(fechaInicio: string, fechaFin: string, fechaIngreso: string): number {
  const startDate = fechaIngreso > fechaInicio ? fechaIngreso : fechaInicio;
  return Math.max(0, daysFromTo(startDate, fechaFin) + 1);
}

/** `ROUND(salario × 15 × días / 365, 2)` en enteros de centavos, mitad hacia arriba (igual que el SQL). */
export function calculateChristmasBonusAmount(dailySalary: number, days: number): number {
  const salaryInCents = Math.round(dailySalary * CENTS_PER_UNIT);
  const amountInCents = divideRoundingHalfUp(
    salaryInCents * CHRISTMAS_BONUS_DAYS * days,
    CHRISTMAS_BONUS_YEAR_DAYS,
  );
  return amountInCents / CENTS_PER_UNIT;
}

export interface IChristmasBonusDescription {
  formula: string;          // "15 días × 122/365 × $500.00 diarios"
  proportionalNote: string | null;  // "Ingresó el 01/09/2026, proporcional" si ingresó dentro del año
}

/** Texto del Detalle. `proportionalNote` solo aparece cuando la fecha de ingreso recorta el año. */
export function describeChristmasBonus(
  dailySalary: number,
  days: number,
  fechaInicio: string,
  fechaIngreso: string,
): IChristmasBonusDescription {
  const [year, month, day] = fechaIngreso.slice(0, 10).split("-");
  return {
    formula: `${CHRISTMAS_BONUS_DAYS} días × ${days}/${CHRISTMAS_BONUS_YEAR_DAYS} × ${formatPayrollCurrency(dailySalary)} diarios`,
    proportionalNote: fechaIngreso > fechaInicio ? `Ingresó el ${day}/${month}/${year}, proporcional` : null,
  };
}
