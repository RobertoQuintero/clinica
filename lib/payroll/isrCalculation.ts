import type { IIsrBreakdown, IsrSkipReason } from "@/interfaces/payroll_isr";
import type { ITaxParameter, IWithholdingBracket } from "@/interfaces/payroll_tax_parameters";
import { ISR_SKIP_REASON_LABELS } from "@/lib/payroll/constants";
import { findWithholdingBracket, resolveTaxParameterRow } from "@/lib/payroll/taxParameters";

type TaxParameterRow = Pick<ITaxParameter, "clave" | "valor" | "vigente_desde">;

const CENTS_PER_UNIT = 100;
const PERCENT_SCALE = 100;            // porcentaje_excedente tiene 2 decimales
const PARAMETER_SCALE = 10_000;       // tax_parameters.valor tiene 4 decimales

function toCents(amount: number): number {
  return Math.round(amount * CENTS_PER_UNIT);
}

function fromCents(cents: number): number {
  return cents / CENTS_PER_UNIT;
}

/** Redondeo a entero, mitad hacia arriba, de `numerator / denominator` (ambos enteros no negativos). */
function divideRoundingHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

function emptyBreakdown(): IIsrBreakdown {
  return {
    isr_estado: "X",
    isr_motivo: null,
    isr_base_gravable: null,
    isr_ejercicio_tarifa: null,
    isr_limite_inferior: null,
    isr_cuota_fija: null,
    isr_porcentaje_excedente: null,
    isr_causado: null,
    subsidio_monto_mensual: null,
    subsidio_monto_vigente_desde: null,
    subsidio_tope_ingreso_mensual: null,
    subsidio_tope_vigente_desde: null,
    subsidio_factor_dias_mes: null,
    subsidio_factor_vigente_desde: null,
    subsidio_con_derecho: null,
    subsidio_causado: null,
    subsidio_aplicado: null,
    isr_retenido: null,
  };
}

/**
 * Espejo puro del ISR de un renglón fiscal que calcula el SQL de `calculatePayrollPeriod` (donde manda el SQL).
 * - `base`: base gravable (`importe_salario`); `dias`: días pagados, base del subsidio.
 * - `fechaFin`: "YYYY-MM-DD"; resuelve los parámetros y el ejercicio de la tarifa (su año).
 * - `brackets`: tramos de la frecuencia del periodo; aquí se filtran por el ejercicio.
 * Los motivos de "No calculado" se revisan en orden: tarifa, parámetros del subsidio, hueco. En 'N' solo se
 * llenan estado, motivo y base. Con base 0 queda 'C' sin tramo e ISR 0.
 * El derecho al subsidio se compara sin divisiones (`base × factor <= tope × dias`) y todo se opera en enteros
 * escalados para no diferir del `decimal` de SQL Server por redondeo de coma flotante.
 */
export function calculateIsrBreakdown(
  base: number,
  dias: number,
  fechaFin: string,
  brackets: IWithholdingBracket[],
  parameters: TaxParameterRow[],
): IIsrBreakdown {
  const fiscalYear = Number(fechaFin.slice(0, 4));
  const baseInCents = toCents(base);

  const notCalculated = (reason: IsrSkipReason): IIsrBreakdown => ({
    ...emptyBreakdown(),
    isr_estado: "N",
    isr_motivo: reason,
    isr_base_gravable: fromCents(baseInCents),
  });

  const yearBrackets = brackets.filter((bracket) => bracket.ejercicio === fiscalYear);
  if (yearBrackets.length === 0) return notCalculated("no_withholding_table");

  const subsidyAmountRow = resolveTaxParameterRow(parameters, "SUBSIDIO_MONTO_MENSUAL", fechaFin);
  const subsidyIncomeCapRow = resolveTaxParameterRow(parameters, "SUBSIDIO_TOPE_INGRESO_MENSUAL", fechaFin);
  const subsidyDaysFactorRow = resolveTaxParameterRow(parameters, "SUBSIDIO_FACTOR_DIAS_MES", fechaFin);
  if (!subsidyAmountRow || !subsidyIncomeCapRow || !subsidyDaysFactorRow) {
    return notCalculated("missing_subsidy_parameters");
  }

  const bracket = baseInCents === 0 ? null : findWithholdingBracket(yearBrackets, fromCents(baseInCents));
  if (baseInCents > 0 && !bracket) return notCalculated("income_in_gap");

  // ISR causado = ROUND(cuota_fija + (base − limite_inferior) × porcentaje / 100, 2).
  let isrCausadoInCents = 0;
  if (bracket) {
    const surplusInCents = baseInCents - toCents(bracket.limite_inferior);
    const percentScaled = Math.round(bracket.porcentaje_excedente * PERCENT_SCALE);
    isrCausadoInCents =
      toCents(bracket.cuota_fija) + divideRoundingHalfUp(surplusInCents * percentScaled, 100 * PERCENT_SCALE);
  }

  // Derecho: base × factor <= tope × dias, ambos lados escalados a 6 decimales.
  const subsidyAmountScaled = Math.round(subsidyAmountRow.valor * PARAMETER_SCALE);
  const incomeCapScaled = Math.round(subsidyIncomeCapRow.valor * PARAMETER_SCALE);
  const daysFactorScaled = Math.round(subsidyDaysFactorRow.valor * PARAMETER_SCALE);
  const hasSubsidyRight = baseInCents * daysFactorScaled <= incomeCapScaled * dias * CENTS_PER_UNIT;

  // Subsidio causado = ROUND(monto / factor × dias, 2), sin redondear la tasa diaria intermedia.
  const subsidioCausadoInCents = hasSubsidyRight
    ? divideRoundingHalfUp(subsidyAmountScaled * dias * CENTS_PER_UNIT, daysFactorScaled)
    : 0;
  const subsidioAplicadoInCents = Math.min(subsidioCausadoInCents, isrCausadoInCents);

  return {
    isr_estado: "C",
    isr_motivo: null,
    isr_base_gravable: fromCents(baseInCents),
    isr_ejercicio_tarifa: fiscalYear,
    isr_limite_inferior: bracket ? bracket.limite_inferior : null,
    isr_cuota_fija: bracket ? bracket.cuota_fija : null,
    isr_porcentaje_excedente: bracket ? bracket.porcentaje_excedente : null,
    isr_causado: fromCents(isrCausadoInCents),
    subsidio_monto_mensual: subsidyAmountRow.valor,
    subsidio_monto_vigente_desde: subsidyAmountRow.vigente_desde.slice(0, 10),
    subsidio_tope_ingreso_mensual: subsidyIncomeCapRow.valor,
    subsidio_tope_vigente_desde: subsidyIncomeCapRow.vigente_desde.slice(0, 10),
    subsidio_factor_dias_mes: subsidyDaysFactorRow.valor,
    subsidio_factor_vigente_desde: subsidyDaysFactorRow.vigente_desde.slice(0, 10),
    subsidio_con_derecho: hasSubsidyRight,
    subsidio_causado: fromCents(subsidioCausadoInCents),
    subsidio_aplicado: fromCents(subsidioAplicadoInCents),
    isr_retenido: fromCents(isrCausadoInCents - subsidioAplicadoInCents),
  };
}

/** Texto en español del motivo de un "ISR no calculado". */
export function describeIsrSkipReason(reason: IsrSkipReason): string {
  return ISR_SKIP_REASON_LABELS[reason];
}
