/**
 * Cálculo puro del reparto de PTU de una empresa y ejercicio (spec 89, LFT arts. 117 a 131).
 * Sin dependencias de servidor ni de base de datos. Trabaja en enteros de centavos: el fondo,
 * las mitades, los topes y el promedio se redondean half up; las partes por días y por salario
 * se truncan, así nunca se reparte más que el fondo.
 */
import type {
  IPtuCalculatedRow,
  IPtuCalculationParameters,
  IPtuCalculationResult,
  IPtuCalculationRow,
  IPtuHistoryAverage,
  PtuIneligibilityReason,
} from "@/interfaces/payroll_ptu";
import {
  PTU_EVENTUAL_MINIMUM_DAYS,
  PTU_PERMANENT_CONTRACT_TYPE,
  PTU_PROFIT_SHARE_PERCENT,
  PTU_TRUST_SALARY_CAP_FACTOR,
} from "@/lib/payroll/constants";

const toCents = (amount: number): number => Math.round(amount * 100);
const fromCents = (cents: number): number => cents / 100;

/** Redondeo half up de `numerator / denominator` para enteros no negativos. */
function divideRoundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/** Truncado de `numerator × multiplier / denominator`. BigInt: el producto puede pasar de 2^53. */
function multiplyDivideTruncated(numerator: number, multiplier: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number((BigInt(numerator) * BigInt(multiplier)) / BigInt(denominator));
}

/** Motivo por el que el trabajador no entra al reparto, o null si es elegible. Orden de la spec 89. */
export function resolvePtuIneligibility(
  row: Pick<IPtuCalculationRow, "categoria_ptu" | "tipo_contrato" | "dias">,
): PtuIneligibilityReason | null {
  if (row.categoria_ptu === "X") return "excluded_category";
  const contractType = row.tipo_contrato ?? PTU_PERMANENT_CONTRACT_TYPE;
  if (contractType !== PTU_PERMANENT_CONTRACT_TYPE && row.dias < PTU_EVENTUAL_MINIMUM_DAYS) {
    return "eventual_under_60_days";
  }
  if (row.dias === 0) return "no_days";
  return null;
}

/**
 * Promedio de la PTU de los ejercicios anteriores, dividido entre los años con dato.
 * Recibe un importe por año con dato; sin ninguno no existe (null).
 */
export function averagePtuHistory(yearlyAmounts: readonly number[]): IPtuHistoryAverage | null {
  if (yearlyAmounts.length === 0) return null;
  const totalCents = yearlyAmounts.reduce((sum, amount) => sum + toCents(amount), 0);
  return {
    average: fromCents(divideRoundHalfUp(totalCents, yearlyAmounts.length)),
    years: yearlyAmounts.length,
  };
}

/**
 * Calcula todo el reparto: fondo, mitades, elegibilidad, tope de confianza, partes por días y por
 * salario, topes del art. 127 fr. VIII y remanente. `historyByEmployee` trae, por empleado, un
 * importe por cada uno de los tres ejercicios anteriores que tenga dato.
 */
export function calculatePtuDistribution(
  parameters: IPtuCalculationParameters,
  rows: readonly IPtuCalculationRow[],
  historyByEmployee: ReadonlyMap<number, readonly number[]>,
): IPtuCalculationResult {
  // Fondo y mitades
  const profitShareCents = divideRoundHalfUp(toCents(parameters.renta_gravable) * PTU_PROFIT_SHARE_PERCENT, 100);
  const fundCents = profitShareCents + toCents(parameters.ptu_no_cobrada_anterior);
  const halfByDaysCents = divideRoundHalfUp(fundCents, 2);
  const halfBySalaryCents = fundCents - halfByDaysCents;

  // Elegibilidad
  const reasons = rows.map(resolvePtuIneligibility);
  const isEligible = reasons.map((reason) => reason === null);

  // Tope de confianza: 120% del salario diario más alto de los elegibles 'N'
  let highestNormalDailySalaryCents: number | null = null;
  rows.forEach((row, index) => {
    if (!isEligible[index] || row.categoria_ptu !== "N") return;
    const dailySalaryCents = toCents(row.salario_diario_tope);
    if (highestNormalDailySalaryCents === null || dailySalaryCents > highestNormalDailySalaryCents) {
      highestNormalDailySalaryCents = dailySalaryCents;
    }
  });
  const trustDailyCapCents =
    highestNormalDailySalaryCents === null
      ? null
      : divideRoundHalfUp(highestNormalDailySalaryCents * Math.round(PTU_TRUST_SALARY_CAP_FACTOR * 100), 100);

  // Salario de reparto y totales de los elegibles
  const distributionSalaryCents = rows.map((row, index) => {
    if (!isEligible[index]) return 0;
    const salaryCents = toCents(row.salario);
    if (row.categoria_ptu === "C" && trustDailyCapCents !== null) {
      return Math.min(salaryCents, trustDailyCapCents * row.dias);
    }
    return salaryCents;
  });
  const totalDays = rows.reduce((sum, row, index) => sum + (isEligible[index] ? row.dias : 0), 0);
  const totalDistributionSalaryCents = distributionSalaryCents.reduce((sum, cents) => sum + cents, 0);

  const threeMonthsFactorHundredths = Math.round(parameters.factor_tres_meses * 100);

  let totalGrossCents = 0;
  let totalFinalCents = 0;

  const calculatedRows: IPtuCalculatedRow[] = rows.map((row, index) => {
    const reason = reasons[index];
    if (reason !== null) {
      return {
        id_empleado: row.id_empleado, elegible: false, motivo: reason,
        salario_reparto: null, ptu_dias: null, ptu_salario: null, ptu_bruto: null,
        tope_tres_meses: null, promedio_tres_anios: null, anios_promedio: null, ptu_final: 0,
      };
    }

    const byDaysCents = multiplyDivideTruncated(halfByDaysCents, row.dias, totalDays);
    const bySalaryCents = multiplyDivideTruncated(
      halfBySalaryCents, distributionSalaryCents[index], totalDistributionSalaryCents,
    );
    const grossCents = byDaysCents + bySalaryCents;

    const threeMonthsCapCents = divideRoundHalfUp(
      toCents(row.salario_diario_tope) * threeMonthsFactorHundredths, 100,
    );
    const history = averagePtuHistory(historyByEmployee.get(row.id_empleado) ?? []);
    const capCents = Math.max(threeMonthsCapCents, history ? toCents(history.average) : 0);
    const finalCents = Math.min(grossCents, capCents);

    totalGrossCents += grossCents;
    totalFinalCents += finalCents;

    return {
      id_empleado: row.id_empleado, elegible: true, motivo: null,
      salario_reparto: fromCents(distributionSalaryCents[index]),
      ptu_dias: fromCents(byDaysCents),
      ptu_salario: fromCents(bySalaryCents),
      ptu_bruto: fromCents(grossCents),
      tope_tres_meses: fromCents(threeMonthsCapCents),
      promedio_tres_anios: history ? history.average : null,
      anios_promedio: history ? history.years : null,
      ptu_final: fromCents(finalCents),
    };
  });

  return {
    totals: {
      fondo: fromCents(fundCents),
      mitad_dias: fromCents(halfByDaysCents),
      mitad_salario: fromCents(halfBySalaryCents),
      total_dias: totalDays,
      total_salario_reparto: fromCents(totalDistributionSalaryCents),
      tope_salario_diario_confianza: trustDailyCapCents === null ? null : fromCents(trustDailyCapCents),
      total_repartido: fromCents(totalFinalCents),
      remanente_topes: fromCents(totalGrossCents - totalFinalCents),
      // Lo que no se repartió por truncar (o por no haber elegibles): fondo − SUM(bruto)
      remanente_redondeo: fromCents(fundCents - totalGrossCents),
    },
    rows: calculatedRows,
  };
}
