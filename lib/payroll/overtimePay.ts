import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

// Las horas van en décimas (decimal(4,1) en SQL) y el dinero en centavos, para no arrastrar error de flotantes.
const TENTHS_PER_HOUR = 10;
const CENTS_PER_PESO = 100;
const WORKDAY_HOURS = 8;

export interface IOvertimeDayInput {
  fecha: string;   // "YYYY-MM-DD"
  horas: number;   // horas autorizadas del día
}

export interface IOvertimeDaySplit extends IOvertimeDayInput {
  horasDobles:  number;
  horasTriples: number;
}

/**
 * Reparte las horas de los días entre dobles y triples en orden cronológico: las primeras `limit` horas son
 * dobles y el resto triples; el día que cruza el límite se parte. Restata la regla del SQL; si divergen, manda el SQL.
 */
export function splitOvertimeHours(days: IOvertimeDayInput[], limit: number): IOvertimeDaySplit[] {
  const limitTenths = Math.round(limit * TENTHS_PER_HOUR);
  const chronologicalDays = [...days].sort((first, second) => (first.fecha < second.fecha ? -1 : first.fecha > second.fecha ? 1 : 0));

  let accumulatedTenths = 0;
  return chronologicalDays.map((day) => {
    const dayTenths = Math.round(day.horas * TENTHS_PER_HOUR);
    const doubleTenths = Math.max(0, Math.min(dayTenths, limitTenths - accumulatedTenths));
    accumulatedTenths += dayTenths;
    return {
      fecha: day.fecha,
      horas: day.horas,
      horasDobles: doubleTenths / TENTHS_PER_HOUR,
      horasTriples: (dayTenths - doubleTenths) / TENTHS_PER_HOUR,
    };
  });
}

/** round(horas × salarioDiario × multiplicador / 8, 2) en centavos enteros, mitad hacia arriba como el ROUND de SQL. */
function calculateAmountInCents(hours: number, dailySalary: number, multiplier: 2 | 3): number {
  const hoursTenths = Math.round(hours * TENTHS_PER_HOUR);
  const dailySalaryCents = Math.round(dailySalary * CENTS_PER_PESO);
  const numerator = hoursTenths * dailySalaryCents * multiplier;
  const denominator = TENTHS_PER_HOUR * WORKDAY_HOURS;
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/** Importes de un día ya repartido, redondeados a centavos por separado (dobles al ×2 y triples al ×3). */
export function calculateOvertimeDayAmounts(
  doubleHours: number,
  tripleHours: number,
  dailySalary: number,
): { importeDobles: number; importeTriples: number } {
  return {
    importeDobles: calculateAmountInCents(doubleHours, dailySalary, 2) / CENTS_PER_PESO,
    importeTriples: calculateAmountInCents(tripleHours, dailySalary, 3) / CENTS_PER_PESO,
  };
}

/** "2.5 h × $250.00": la tarifa mostrada es salarioDiario / 8 × multiplicador; el importe real es siempre el guardado. */
export function describeOvertimeHours(hours: number, dailySalary: number, multiplier: 2 | 3): string {
  const hourlyRate = (dailySalary / WORKDAY_HOURS) * multiplier;
  return `${hours} h × ${formatPayrollCurrency(hourlyRate)}`;
}
