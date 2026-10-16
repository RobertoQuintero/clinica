import type { Article174SkipReason, IArticle174IsrBreakdown } from "@/interfaces/payroll_christmas_bonus";
import type { IWithholdingBracket } from "@/interfaces/payroll_tax_parameters";
import {
  ARTICLE_174_MONTH_DAYS_FACTOR,
  ARTICLE_174_SKIP_REASON_LABELS,
  CHRISTMAS_BONUS_YEAR_DAYS,
} from "@/lib/payroll/constants";
import { findWithholdingBracket } from "@/lib/payroll/taxParameters";

const CENTS_PER_UNIT = 100;
const PERCENT_SCALE = 100;                 // porcentaje_excedente tiene 2 decimales
const RATE_SCALE = 1_000_000;              // tasa con 6 decimales
const MONTH_DAYS_FACTOR_SCALE = 10;        // 30.4 -> 304 / 10

function toCents(amount: number): number {
  return Math.round(amount * CENTS_PER_UNIT);
}

function fromCents(cents: number): number {
  return cents / CENTS_PER_UNIT;
}

/** `ROUND(numerator / denominator)` de SQL: mitad alejándose del cero. Denominador positivo. */
function divideRoundingHalfUp(numerator: number, denominator: number): number {
  const sign = numerator < 0 ? -1 : 1;
  return sign * Math.floor((2 * Math.abs(numerator) + denominator) / (2 * denominator));
}

function emptyBreakdown(): IArticle174IsrBreakdown {
  return {
    isr_estado: "N",
    isr_motivo: null,
    base_gravable: null,
    ingreso_ordinario_mensual: null,
    parte_mensualizada: null,
    ejercicio_tarifa: null,
    limite_inferior_ordinario: null,
    cuota_fija_ordinario: null,
    porcentaje_ordinario: null,
    isr_ordinario: null,
    limite_inferior_total: null,
    cuota_fija_total: null,
    porcentaje_total: null,
    isr_total: null,
    diferencia_isr: null,
    tasa: null,
    isr_retenido: null,
  };
}

/** `ROUND(cuota_fija + (ingreso − limite_inferior) × porcentaje / 100, 2)` en centavos. */
function calculateBracketIsrInCents(incomeInCents: number, bracket: IWithholdingBracket): number {
  const surplusInCents = incomeInCents - toCents(bracket.limite_inferior);
  const percentScaled = Math.round(bracket.porcentaje_excedente * PERCENT_SCALE);
  return toCents(bracket.cuota_fija) + divideRoundingHalfUp(surplusInCents * percentScaled, 100 * PERCENT_SCALE);
}

/**
 * Espejo puro del ISR art. 174 RLISR del aguinaldo que calcula el SQL de `calculatePayrollPeriod` (donde manda el SQL).
 * - `taxedAmount`: gravado del aguinaldo (spec 73); `hasPendingExemption`: su exento quedó sin calcular.
 * - `dailyFiscalSalary`: base del ingreso ordinario mensual (`salario × 30.4`).
 * - `monthlyBrackets`: tarifa mensual; aquí se filtra por el año de `fechaFin` ("YYYY-MM-DD").
 * Motivos de "No calculado", en orden: exento pendiente, sin tarifa mensual, hueco.
 * Pasos: parte mensualizada = base / 365 × 30.4; ISR del ordinario y del ordinario + parte;
 * tasa = ROUND(diferencia / parte, 6); retenido = ROUND(base × tasa, 2). Base 0 queda 'C' con ISR 0 y sin tramos.
 * Se opera en enteros escalados para no diferir del `decimal` de SQL Server.
 */
export function calculateArticle174Isr(
  taxedAmount: number,
  hasPendingExemption: boolean,
  dailyFiscalSalary: number,
  monthlyBrackets: IWithholdingBracket[],
  fechaFin: string,
): IArticle174IsrBreakdown {
  const fiscalYear = Number(fechaFin.slice(0, 4));
  const baseInCents = toCents(taxedAmount);

  const notCalculated = (reason: Article174SkipReason): IArticle174IsrBreakdown => ({
    ...emptyBreakdown(),
    isr_motivo: reason,
    base_gravable: reason === "exemption_not_calculated" ? null : fromCents(baseInCents),
  });

  if (hasPendingExemption) return notCalculated("exemption_not_calculated");

  const yearBrackets = monthlyBrackets.filter((bracket) => bracket.ejercicio === fiscalYear);
  if (yearBrackets.length === 0) return notCalculated("no_monthly_withholding_table");

  const monthDaysFactorScaled = Math.round(ARTICLE_174_MONTH_DAYS_FACTOR * MONTH_DAYS_FACTOR_SCALE);
  const ordinaryIncomeInCents = divideRoundingHalfUp(
    toCents(dailyFiscalSalary) * monthDaysFactorScaled,
    MONTH_DAYS_FACTOR_SCALE,
  );
  const monthlyPortionInCents = divideRoundingHalfUp(
    baseInCents * monthDaysFactorScaled,
    CHRISTMAS_BONUS_YEAR_DAYS * MONTH_DAYS_FACTOR_SCALE,
  );

  const common = {
    ...emptyBreakdown(),
    isr_estado: "C" as const,
    base_gravable: fromCents(baseInCents),
    ingreso_ordinario_mensual: fromCents(ordinaryIncomeInCents),
    parte_mensualizada: fromCents(monthlyPortionInCents),
    ejercicio_tarifa: fiscalYear,
  };

  if (baseInCents === 0) {
    return { ...common, isr_ordinario: 0, isr_total: 0, diferencia_isr: 0, tasa: 0, isr_retenido: 0 };
  }

  const ordinaryBracket = findWithholdingBracket(yearBrackets, fromCents(ordinaryIncomeInCents));
  const totalBracket = findWithholdingBracket(yearBrackets, fromCents(ordinaryIncomeInCents + monthlyPortionInCents));
  if (!ordinaryBracket || !totalBracket) return notCalculated("income_in_gap");

  const ordinaryIsrInCents = calculateBracketIsrInCents(ordinaryIncomeInCents, ordinaryBracket);
  const totalIsrInCents = calculateBracketIsrInCents(ordinaryIncomeInCents + monthlyPortionInCents, totalBracket);
  const differenceInCents = totalIsrInCents - ordinaryIsrInCents;

  const rateScaled = monthlyPortionInCents === 0
    ? 0
    : divideRoundingHalfUp(differenceInCents * RATE_SCALE, monthlyPortionInCents);
  const withheldInCents = divideRoundingHalfUp(baseInCents * rateScaled, RATE_SCALE);

  return {
    ...common,
    limite_inferior_ordinario: ordinaryBracket.limite_inferior,
    cuota_fija_ordinario: ordinaryBracket.cuota_fija,
    porcentaje_ordinario: ordinaryBracket.porcentaje_excedente,
    isr_ordinario: fromCents(ordinaryIsrInCents),
    limite_inferior_total: totalBracket.limite_inferior,
    cuota_fija_total: totalBracket.cuota_fija,
    porcentaje_total: totalBracket.porcentaje_excedente,
    isr_total: fromCents(totalIsrInCents),
    diferencia_isr: fromCents(differenceInCents),
    tasa: rateScaled / RATE_SCALE,
    isr_retenido: fromCents(withheldInCents),
  };
}

/** Texto en español del motivo de un "ISR art. 174 no calculado". */
export function describeArticle174SkipReason(reason: Article174SkipReason): string {
  return ARTICLE_174_SKIP_REASON_LABELS[reason];
}
