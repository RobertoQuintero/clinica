import type { IPayrollEmployeeSnapshot } from "@/interfaces/payroll_calculation";
import type {
  IPunctualityBonusEvaluation,
  IPunctualityBonusSetting,
} from "@/interfaces/payroll_punctuality_bonus";

export interface IPunctualityBonusEvaluationInput {
  hasLatenessSettings: boolean;
  /** Configuración de la frecuencia del periodo; null si no tiene fila. */
  setting:             Pick<IPunctualityBonusSetting, "monto" | "maximo_incidencias" | "status"> | null;
  fechaIngreso:        string;   // "YYYY-MM-DD"
  fechaInicio:         string;   // "YYYY-MM-DD"
  hasSchedule:         boolean;
  lateCount:           number;   // retardos injustificados (graves + acumulables)
  absenceCount:        number;   // faltas injustificadas
}

/**
 * Espejo puro de la evaluación del bono de puntualidad que hace el SQL del cálculo (donde manda el SQL).
 * Los motivos de "No evaluado" se revisan en el orden de `PunctualityBonusSkipReason`. Los conteos se
 * devuelven tal cual aunque no se evalúe, para que la pantalla los muestre; el snapshot los guarda en 0.
 * Las fechas son "YYYY-MM-DD" y se comparan como strings.
 */
export function evaluatePunctualityBonus(input: IPunctualityBonusEvaluationInput): IPunctualityBonusEvaluation {
  const { hasLatenessSettings, setting, fechaIngreso, fechaInicio, hasSchedule, lateCount, absenceCount } = input;
  const incidentCount = lateCount + absenceCount;

  const notEvaluated = (
    skipReason: NonNullable<IPunctualityBonusEvaluation["skipReason"]>,
  ): IPunctualityBonusEvaluation => ({
    lateCount,
    absenceCount,
    incidentCount,
    maximumIncidents: null,
    result: "not_evaluated",
    skipReason,
    amount: 0,
  });

  if (!hasLatenessSettings) return notEvaluated("no_lateness_settings");
  if (!setting || !setting.status) return notEvaluated("bonus_not_configured");
  if (fechaIngreso > fechaInicio) return notEvaluated("joined_mid_period");
  if (!hasSchedule) return notEvaluated("no_schedule");

  const keeps = incidentCount <= setting.maximo_incidencias;
  return {
    lateCount,
    absenceCount,
    incidentCount,
    maximumIncidents: setting.maximo_incidencias,
    result: keeps ? "keeps" : "loses",
    skipReason: null,
    amount: keeps ? setting.monto : 0,
  };
}

export interface IPunctualityBonusLineText {
  label:       string;   // "Bono de puntualidad"
  description: string;   // "1 incidencia de 1 permitida" | "Perdido: 2 incidencias (máximo 1)"
  amount:      number;   // importe congelado en el snapshot
}

function formatIncidents(count: number): string {
  return count === 1 ? "1 incidencia" : `${count} incidencias`;
}

/**
 * Textos de la línea "Bono de puntualidad" del Detalle, a partir del snapshot. Con 'N' (o sin máximo
 * congelado) devuelve null: la línea se omite. Con 'P' devuelve $0 y el motivo, a propósito.
 */
export function describePunctualityBonus(
  snapshot: Pick<
    IPayrollEmployeeSnapshot,
    | "bono_puntualidad_resultado"
    | "bono_puntualidad_retardos"
    | "bono_puntualidad_faltas"
    | "bono_puntualidad_maximo"
    | "importe_bono_puntualidad"
  >,
): IPunctualityBonusLineText | null {
  const maximum = snapshot.bono_puntualidad_maximo;
  if (snapshot.bono_puntualidad_resultado === "N" || maximum === null) return null;

  const incidents = snapshot.bono_puntualidad_retardos + snapshot.bono_puntualidad_faltas;

  if (snapshot.bono_puntualidad_resultado === "C") {
    const allowed = maximum === 1 ? "1 permitida" : `${maximum} permitidas`;
    return {
      label: "Bono de puntualidad",
      description: `${formatIncidents(incidents)} de ${allowed}`,
      amount: snapshot.importe_bono_puntualidad,
    };
  }

  return {
    label: "Bono de puntualidad",
    description: `Perdido: ${formatIncidents(incidents)} (máximo ${maximum})`,
    amount: 0,
  };
}
