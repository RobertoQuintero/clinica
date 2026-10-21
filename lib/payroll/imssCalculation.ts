import type { IEmployeeSbc } from "@/interfaces/employee_sbc";
import type { IImssBreakdown, ImssSkipReason, ImssStatus } from "@/interfaces/payroll_imss";
import type { ITaxParameter } from "@/interfaces/payroll_tax_parameters";
import { IMSS_CONTRIBUTION_REGIME, IMSS_SKIP_REASON_LABELS } from "@/lib/payroll/constants";
import { resolveTaxParameterRow } from "@/lib/payroll/taxParameters";

type TaxParameterRow = Pick<ITaxParameter, "clave" | "valor" | "vigente_desde">;
type EmployeeSbcRow = Pick<IEmployeeSbc, "sbc" | "vigente_desde">;

const CENTS_PER_UNIT = 100;
const PARAMETER_SCALE = 10_000;   // tax_parameters.valor tiene 4 decimales
const PERCENT_DIVISOR = 100;

function toCents(amount: number): number {
  return Math.round(amount * CENTS_PER_UNIT);
}

function fromCents(cents: number): number {
  return cents / CENTS_PER_UNIT;
}

function toScaled(parameterValue: number): number {
  return Math.round(parameterValue * PARAMETER_SCALE);
}

/** Redondeo a entero, mitad hacia arriba, de `numerator / denominator` (ambos enteros no negativos). */
function divideRoundingHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/** Centavos de `multiplesScaled × dailyAmountScaled`: ROUND(umas × uma, 2) con ambos factores a 4 decimales. */
function multiplyScaledToCents(firstScaled: number, secondScaled: number): number {
  return divideRoundingHalfUp(firstScaled * secondScaled * CENTS_PER_UNIT, PARAMETER_SCALE * PARAMETER_SCALE);
}

/** Cuota de un ramo en centavos: ROUND(base × días × tasa / 100, 2), con la tasa escalada a 4 decimales. */
function contributionInCents(dailyBaseInCents: number, days: number, rateScaled: number): number {
  return divideRoundingHalfUp(dailyBaseInCents * days * rateScaled, PARAMETER_SCALE * PERCENT_DIVISOR);
}

/**
 * SBC vigente a `fechaFin`: el de `vigente_desde` más reciente que no pase de esa fecha, o null si no hay.
 * Misma regla que `resolveTaxParameterRow`; las fechas son "YYYY-MM-DD" y se comparan como texto.
 */
export function resolveEmployeeSbc<Row extends EmployeeSbcRow>(rows: Row[], fechaFin: string): Row | null {
  const effectiveDay = fechaFin.slice(0, 10);
  let latestRow: Row | null = null;
  for (const row of rows) {
    if (row.vigente_desde.slice(0, 10) > effectiveDay) continue;
    if (latestRow === null || row.vigente_desde > latestRow.vigente_desde) latestRow = row;
  }
  return latestRow;
}

export interface IImssCalculationInput {
  /** `RH.empleados.tipo_regimen`; solo el 02 lleva IMSS. */
  contributionRegime: string | null;
  nss: string | null;
  /** Historial completo del SBC del empleado. */
  sbcRows: EmployeeSbcRow[];
  /** "YYYY-MM-DD": resuelve el SBC y los parámetros. */
  fechaFin: string;
  /** Días pagados (IV y CEAV) y faltas (EyM usa `dias + diasFalta`). */
  dias: number;
  diasFalta: number;
  /** `salario_diario` del renglón 'F', para la exención del art. 36. */
  dailyWage: number;
  /** Total de percepciones del renglón 'F' y su ISR retenido (null si no está calculado, cuenta como 0). */
  totalPerceptions: number;
  isrRetained: number | null;
  /** UMA, salario mínimo y las 7 claves IMSS, con todas sus vigencias. */
  parameters: TaxParameterRow[];
}

export interface IImssCalculationResult {
  estado: ImssStatus;
  motivo: ImssSkipReason | null;
  /** Solo con `estado = 'C'`. */
  breakdown: IImssBreakdown | null;
}

function notApplicable(): IImssCalculationResult {
  return { estado: "X", motivo: null, breakdown: null };
}

function notCalculated(reason: ImssSkipReason): IImssCalculationResult {
  return { estado: "N", motivo: reason, breakdown: null };
}

/**
 * Espejo puro de la cuota obrera del IMSS de un renglón fiscal que calcula el SQL de `calculatePayrollPeriod`
 * (donde manda el SQL). Se opera en enteros escalados (centavos y tasas a 4 decimales) para no diferir del
 * `decimal` de SQL Server por redondeo de coma flotante.
 * - Régimen distinto de 02: 'X'. Los motivos de 'N' se revisan en orden: NSS, SBC, UMA, 7 claves IMSS, salario mínimo.
 * - SBC topado = min(SBC, ROUND(tope en UMA × UMA, 2)); el excedente es lo que pasa de ROUND(umbral en UMA × UMA, 2).
 * - EyM usa `dias + diasFalta`; IV y CEAV usan `dias`. Cada ramo se redondea por separado y la causada suma los redondeos.
 * - Retenido: 0 si el salario diario no supera el mínimo (art. 36); si no, min(causada, max(0, percepciones − ISR)).
 */
export function calculateImssBreakdown(input: IImssCalculationInput): IImssCalculationResult {
  if (input.contributionRegime !== IMSS_CONTRIBUTION_REGIME) return notApplicable();
  if (!input.nss || input.nss.trim() === "") return notCalculated("missing_nss");

  const sbcRow = resolveEmployeeSbc(input.sbcRows, input.fechaFin);
  if (!sbcRow) return notCalculated("missing_sbc");

  const resolve = (key: TaxParameterRow["clave"]) => resolveTaxParameterRow(input.parameters, key, input.fechaFin);

  const umaRow = resolve("UMA_DIARIA");
  if (!umaRow) return notCalculated("missing_uma");

  const excessRateRow = resolve("IMSS_OBRERO_EYM_EXCEDENTE");
  const cashRateRow = resolve("IMSS_OBRERO_EYM_DINERO");
  const pensionersRateRow = resolve("IMSS_OBRERO_EYM_PENSIONADOS");
  const disabilityRateRow = resolve("IMSS_OBRERO_IV");
  const retirementRateRow = resolve("IMSS_OBRERO_CEAV");
  const thresholdUmasRow = resolve("IMSS_UMBRAL_EXCEDENTE_UMAS");
  const capUmasRow = resolve("IMSS_TOPE_SBC_UMAS");
  if (
    !excessRateRow || !cashRateRow || !pensionersRateRow || !disabilityRateRow ||
    !retirementRateRow || !thresholdUmasRow || !capUmasRow
  ) {
    return notCalculated("missing_imss_parameters");
  }

  const minimumWageRow = resolve("SALARIO_MINIMO_GENERAL");
  if (!minimumWageRow) return notCalculated("missing_minimum_wage");

  const umaScaled = toScaled(umaRow.valor);
  const capInCents = multiplyScaledToCents(toScaled(capUmasRow.valor), umaScaled);
  const thresholdInCents = multiplyScaledToCents(toScaled(thresholdUmasRow.valor), umaScaled);
  const sbcInCents = toCents(sbcRow.sbc);
  const cappedSbcInCents = Math.min(sbcInCents, capInCents);
  const dailyExcessInCents = Math.max(0, cappedSbcInCents - thresholdInCents);

  const eymDays = input.dias + input.diasFalta;
  const ivCeavDays = input.dias;

  const excessContribution = contributionInCents(dailyExcessInCents, eymDays, toScaled(excessRateRow.valor));
  const cashContribution = contributionInCents(cappedSbcInCents, eymDays, toScaled(cashRateRow.valor));
  const pensionersContribution = contributionInCents(cappedSbcInCents, eymDays, toScaled(pensionersRateRow.valor));
  const disabilityContribution = contributionInCents(cappedSbcInCents, ivCeavDays, toScaled(disabilityRateRow.valor));
  const retirementContribution = contributionInCents(cappedSbcInCents, ivCeavDays, toScaled(retirementRateRow.valor));
  const accruedInCents =
    excessContribution + cashContribution + pensionersContribution + disabilityContribution + retirementContribution;

  const isExemptByMinimumWage = toCents(input.dailyWage) <= toCents(minimumWageRow.valor);
  const netCapInCents = Math.max(0, toCents(input.totalPerceptions) - toCents(input.isrRetained ?? 0));
  const isCappedToNet = !isExemptByMinimumWage && accruedInCents > netCapInCents;
  const withheldInCents = isExemptByMinimumWage ? 0 : Math.min(accruedInCents, netCapInCents);

  const latestParametersDate = [
    excessRateRow, cashRateRow, pensionersRateRow, disabilityRateRow, retirementRateRow, thresholdUmasRow, capUmasRow,
  ]
    .map((row) => row.vigente_desde.slice(0, 10))
    .reduce((latest, current) => (current > latest ? current : latest));

  return {
    estado: "C",
    motivo: null,
    breakdown: {
      sbc: sbcRow.sbc,
      sbc_vigente_desde: sbcRow.vigente_desde.slice(0, 10),
      uma_diaria: umaRow.valor,
      uma_vigente_desde: umaRow.vigente_desde.slice(0, 10),
      salario_minimo: minimumWageRow.valor,
      salario_minimo_vigente_desde: minimumWageRow.vigente_desde.slice(0, 10),
      parametros_vigente_desde: latestParametersDate,
      tope_sbc_umas: capUmasRow.valor,
      umbral_excedente_umas: thresholdUmasRow.valor,
      tope_sbc: fromCents(capInCents),
      sbc_topado: fromCents(cappedSbcInCents),
      umbral_excedente: fromCents(thresholdInCents),
      excedente_diario: fromCents(dailyExcessInCents),
      dias_eym: eymDays,
      dias_iv_ceav: ivCeavDays,
      tasa_eym_excedente: excessRateRow.valor,
      importe_eym_excedente: fromCents(excessContribution),
      tasa_eym_dinero: cashRateRow.valor,
      importe_eym_dinero: fromCents(cashContribution),
      tasa_eym_pensionados: pensionersRateRow.valor,
      importe_eym_pensionados: fromCents(pensionersContribution),
      tasa_iv: disabilityRateRow.valor,
      importe_iv: fromCents(disabilityContribution),
      tasa_ceav: retirementRateRow.valor,
      importe_ceav: fromCents(retirementContribution),
      cuota_causada: fromCents(accruedInCents),
      exento_salario_minimo: isExemptByMinimumWage,
      tope_neto: fromCents(netCapInCents),
      topado_al_neto: isCappedToNet,
      imss_retenido: fromCents(withheldInCents),
    },
  };
}

/** Texto en español del motivo de un "IMSS no calculado". */
export function describeImssSkipReason(reason: ImssSkipReason): string {
  return IMSS_SKIP_REASON_LABELS[reason];
}
