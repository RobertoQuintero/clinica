const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY;
}

/**
 * Días naturales pagados: `fin − max(inicio, ingreso) + 1`, o 0 si el ingreso es posterior al fin.
 * Recibe y compara strings "YYYY-MM-DD"; el `Date` es solo interno para contar días.
 */
export function countPaidDays(startDate: string, endDate: string, hireDate: string): number {
  const effectiveStartDate = hireDate > startDate ? hireDate : startDate;
  if (effectiveStartDate > endDate) return 0;
  return toUtcDayNumber(endDate) - toUtcDayNumber(effectiveStartDate) + 1;
}

/** Importe del salario redondeado a 2 decimales (half away from zero para montos positivos). */
export function calculateSalaryAmount(dailySalary: number, paidDays: number): number {
  return Math.round(dailySalary * paidDays * 100) / 100;
}
