import type {
  ExemptionSkipReason,
  ExemptionStatus,
  IPeriodEmployeePerception,
} from "@/interfaces/payroll_exemption";
import type { IPerception } from "@/interfaces/payroll_tax_parameters";
import { EXEMPTION_SKIP_REASON_LABELS } from "@/lib/payroll/constants";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

type ExemptionRule = Pick<
  IPerception,
  "tipo_limite_exencion" | "porcentaje_exento" | "umas_limite" | "periodicidad_limite"
>;

export interface IExemptionCalculationInput {
  importe: number;
  rule: ExemptionRule;
  /** Eventos del renglón; obligatorio (entero > 0) en periodicidad 'E'. */
  eventos: number | null;
  /** `period_employees.dias`; multiplica el tope en periodicidad 'D'. */
  diasPagados: number;
  /** `UMA_DIARIA` vigente a `fecha_fin`; `null` si no hay. */
  umaDiaria: number | null;
  /** La frecuencia del periodo es semanal (`clave_sat = '02'`). */
  isWeeklyFrequency: boolean;
  /** Exento ya consumido por la misma percepción y empleado en periodos anteriores ('A' y 'M'); 0 en el resto. */
  consumedBefore: number;
}

export interface IExemptionBreakdown {
  estado: ExemptionStatus;
  motivo: ExemptionSkipReason | null;
  /** Tope de la ventana; solo en tipos 'U' y 'M' calculados. */
  tope: number | null;
  exento: number | null;
  gravado: number | null;
}

const CENTS_PER_UNIT = 100;
const PERCENT_SCALE = 100;       // porcentaje_exento tiene 2 decimales
const UMA_SCALE = 10_000;        // umas_limite y uma_diaria tienen 4 decimales

function toScaled(amount: number, scale: number): number {
  return Math.round(amount * scale);
}

/** Redondeo a entero, mitad hacia arriba, de `numerator / denominator` (ambos enteros no negativos). */
function divideRoundingHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

function notCalculated(reason: ExemptionSkipReason): IExemptionBreakdown {
  return { estado: "N", motivo: reason, tope: null, exento: null, gravado: null };
}

function calculated(importeInCents: number, exemptInCents: number, topeInCents: number | null): IExemptionBreakdown {
  return {
    estado: "C",
    motivo: null,
    tope: topeInCents === null ? null : topeInCents / CENTS_PER_UNIT,
    exento: exemptInCents / CENTS_PER_UNIT,
    // El gravado nunca se redondea por separado: gravado + exento = importe al centavo.
    gravado: (importeInCents - exemptInCents) / CENTS_PER_UNIT,
  };
}

/**
 * Espejo puro del motor de exento que calcula el SQL de `calculatePayrollPeriod` (donde manda el SQL).
 * Lee solo la regla del catálogo; ninguna rama sabe de qué concepto se trata:
 *   N: 0 · T: importe · P: ROUND(importe × % / 100, 2) · U: min(importe, tope restante)
 *   M: min(ROUND(importe × % / 100, 2), tope restante)
 * Tope = ROUND(umas × UMA × multiplicador, 2); el multiplicador es `eventos` en 'E', `diasPagados` en 'D' y 1
 * en el resto. Tope restante = max(0, tope − consumedBefore). Todo en enteros escalados, con el mismo redondeo
 * (mitad hacia arriba) que `ROUND` de SQL Server, para no diferir del `decimal` por coma flotante.
 */
export function calculatePerceptionExemption(input: IExemptionCalculationInput): IExemptionBreakdown {
  const { importe, rule, eventos, diasPagados, umaDiaria, isWeeklyFrequency, consumedBefore } = input;
  const importeInCents = toScaled(importe, CENTS_PER_UNIT);
  const limitType = rule.tipo_limite_exencion;

  if (limitType === "N") return calculated(importeInCents, 0, null);
  if (limitType === "T") return calculated(importeInCents, importeInCents, null);

  const percentExemptInCents = (): number => {
    if (rule.porcentaje_exento === null) throw new Error("La regla de porcentaje no trae porcentaje_exento");
    return divideRoundingHalfUp(
      importeInCents * toScaled(rule.porcentaje_exento, PERCENT_SCALE),
      100 * PERCENT_SCALE,
    );
  };

  if (limitType === "P") return calculated(importeInCents, percentExemptInCents(), null);

  // 'U' y 'M' usan la UMA y un tope de ventana.
  if (rule.umas_limite === null || rule.periodicidad_limite === null) {
    throw new Error("La regla con tope no trae umas_limite o periodicidad_limite");
  }
  if (umaDiaria === null) return notCalculated("missing_uma");
  if (rule.periodicidad_limite === "S" && !isWeeklyFrequency) return notCalculated("unsupported_frequency");

  let multiplier = 1;
  if (rule.periodicidad_limite === "E") {
    if (eventos === null || !Number.isInteger(eventos) || eventos <= 0) {
      throw new Error("La periodicidad 'E' requiere eventos enteros mayores que 0");
    }
    multiplier = eventos;
  } else if (rule.periodicidad_limite === "D") {
    multiplier = diasPagados;
  }

  const topeInCents = divideRoundingHalfUp(
    toScaled(rule.umas_limite, UMA_SCALE) * toScaled(umaDiaria, UMA_SCALE) * multiplier,
    (UMA_SCALE * UMA_SCALE) / CENTS_PER_UNIT,
  );
  const remainingInCents = Math.max(0, topeInCents - toScaled(consumedBefore, CENTS_PER_UNIT));
  const baseExemptInCents = limitType === "M" ? percentExemptInCents() : importeInCents;

  return calculated(importeInCents, Math.min(baseExemptInCents, remainingInCents), topeInCents);
}

const PERIODICITY_PHRASES: Record<string, string> = {
  D: "por día",
  S: "por semana",
  M: "al mes",
  A: "al año",
  E: "por evento",
};

function formatPercent(percent: number): string {
  return `${percent}%`;
}

/** Nota del Detalle con la regla que se aplicó al renglón, a partir de la regla congelada en él. */
export function describePerceptionExemption(
  line: Pick<
    IPeriodEmployeePerception,
    | "exencion_estado" | "exencion_motivo" | "tipo_limite_exencion" | "porcentaje_exento" | "umas_limite"
    | "periodicidad_limite" | "tope_exento" | "exento_consumido_previo" | "uma_vigente_desde"
  >,
): string {
  if (line.exencion_estado === "N") {
    const reasonLabel = line.exencion_motivo ? EXEMPTION_SKIP_REASON_LABELS[line.exencion_motivo] : null;
    return reasonLabel ? `No calculado: ${reasonLabel}` : "No calculado";
  }

  switch (line.tipo_limite_exencion) {
    case "N":
      return "Gravado al 100%";
    case "T":
      return "Exento al 100%";
    case "P":
      return `Exento ${formatPercent(line.porcentaje_exento ?? 0)}`;
    case "U":
    case "M": {
      const headline =
        line.tipo_limite_exencion === "M"
          ? `Exento ${formatPercent(line.porcentaje_exento ?? 0)} hasta`
          : "Exento hasta";
      const periodicity = line.periodicidad_limite ? PERIODICITY_PHRASES[line.periodicidad_limite] : "";
      const limit = `${line.umas_limite ?? 0} UMA ${periodicity}`.trim();
      const tope = formatPayrollCurrency(line.tope_exento ?? 0);
      if (line.periodicidad_limite === "A" || line.periodicidad_limite === "M") {
        const used = formatPayrollCurrency(line.exento_consumido_previo ?? 0);
        const umaSince = line.uma_vigente_desde ? ` (UMA desde ${line.uma_vigente_desde})` : "";
        return `${headline} ${limit}: tope ${tope}, usado antes ${used}${umaSince}`;
      }
      return `${headline} ${limit} (tope ${tope})`;
    }
  }
}
