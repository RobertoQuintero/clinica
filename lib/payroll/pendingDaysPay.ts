import { nextDate } from "@/lib/payroll/absenceDetection";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

const CENTS_PER_PESO = 100;

/**
 * Una fecha por día de [desde, hasta], inclusive, en orden. `[]` si `desde` es posterior a `hasta`.
 * Opera sobre strings "YYYY-MM-DD"; si difiere del SQL, manda el SQL.
 */
export function expandDateRange(desde: string, hasta: string): string[] {
  if (desde > hasta) return [];
  const dates: string[] = [];
  for (let date = desde; date <= hasta; date = nextDate(date)) {
    dates.push(date);
  }
  return dates;
}

/** ROUND(tarifa, 2), mitad hacia arriba como el ROUND de SQL. Una tarifa de 0 da un importe de 0. */
export function calculatePendingDayAmount(dailyRate: number): number {
  return Math.round(dailyRate * CENTS_PER_PESO) / CENTS_PER_PESO;
}

export interface IPendingDaysAmountTotals {
  totalOperativa: number;
  totalFiscal:    number;
}

/**
 * Suma de los importes estimados de un conjunto de capturas, por tipo de nómina. Una tarifa en 0 no
 * suma en ese tipo (es la forma en que la captura dice "no se paga en esa nómina").
 */
export function sumPendingDays(
  rows: { tarifa_operativa: number; tarifa_fiscal: number }[],
): IPendingDaysAmountTotals {
  return rows.reduce<IPendingDaysAmountTotals>(
    (totals, row) => ({
      totalOperativa: Math.round((totals.totalOperativa + calculatePendingDayAmount(row.tarifa_operativa)) * CENTS_PER_PESO) / CENTS_PER_PESO,
      totalFiscal: Math.round((totals.totalFiscal + calculatePendingDayAmount(row.tarifa_fiscal)) * CENTS_PER_PESO) / CENTS_PER_PESO,
    }),
    { totalOperativa: 0, totalFiscal: 0 },
  );
}

/** "N días × $X diarios", para la línea del Detalle y el texto secundario de Procesar. */
export function describePendingDays(dias: number, dailyRate: number): string {
  return `${dias} ${dias === 1 ? "día" : "días"} × ${formatPayrollCurrency(dailyRate)} diarios`;
}
