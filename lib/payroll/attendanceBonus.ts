import type {
  AttendanceBonusSkipReason,
  IAttendanceBonusEvaluation,
  IAttendanceBonusSetting,
} from "@/interfaces/payroll_attendance_bonus";
import type { IPayrollEmployeeSnapshot } from "@/interfaces/payroll_calculation";

export interface IAttendanceBonusEvaluationInput {
  /** Configuración de la frecuencia del periodo; null si no tiene fila. */
  setting:      Pick<IAttendanceBonusSetting, "monto" | "status"> | null;
  fechaIngreso: string;   // "YYYY-MM-DD"
  fechaInicio:  string;   // "YYYY-MM-DD"
  hasSchedule:  boolean;
  absenceCount: number;   // faltas injustificadas
}

/**
 * Espejo puro de la evaluación del bono de asistencia que hace el SQL del cálculo (donde manda el SQL).
 * Los motivos de "No evaluado" se revisan en el orden de `AttendanceBonusSkipReason`. El conteo de faltas
 * se devuelve tal cual aunque no se evalúe, para que la pantalla lo muestre; el snapshot lo guarda en 0.
 * Las fechas son "YYYY-MM-DD" y se comparan como strings.
 */
export function evaluateAttendanceBonus(input: IAttendanceBonusEvaluationInput): IAttendanceBonusEvaluation {
  const { setting, fechaIngreso, fechaInicio, hasSchedule, absenceCount } = input;

  const notEvaluated = (skipReason: AttendanceBonusSkipReason): IAttendanceBonusEvaluation => ({
    absenceCount,
    result: "not_evaluated",
    skipReason,
    amount: 0,
  });

  if (!setting || !setting.status) return notEvaluated("bonus_not_configured");
  if (fechaIngreso > fechaInicio) return notEvaluated("joined_mid_period");
  if (!hasSchedule) return notEvaluated("no_schedule");

  const keeps = absenceCount === 0;
  return {
    absenceCount,
    result: keeps ? "keeps" : "loses",
    skipReason: null,
    amount: keeps ? setting.monto : 0,
  };
}

export interface IAttendanceBonusLineText {
  label:       string;   // "Bono de asistencia"
  description: string;   // "Sin faltas en el periodo" | "Perdido: 2 faltas"
  amount:      number;   // importe congelado en el snapshot
}

function formatAbsences(count: number): string {
  return count === 1 ? "1 falta" : `${count} faltas`;
}

/**
 * Textos de la línea "Bono de asistencia" del Detalle, a partir del snapshot. Con 'N' devuelve null: la
 * línea se omite. Con 'P' devuelve $0 y el motivo, a propósito.
 */
export function describeAttendanceBonus(
  snapshot: Pick<
    IPayrollEmployeeSnapshot,
    "bono_asistencia_resultado" | "bono_asistencia_faltas" | "importe_bono_asistencia"
  >,
): IAttendanceBonusLineText | null {
  if (snapshot.bono_asistencia_resultado === "N") return null;

  if (snapshot.bono_asistencia_resultado === "C") {
    return {
      label: "Bono de asistencia",
      description: "Sin faltas en el periodo",
      amount: snapshot.importe_bono_asistencia,
    };
  }

  return {
    label: "Bono de asistencia",
    description: `Perdido: ${formatAbsences(snapshot.bono_asistencia_faltas)}`,
    amount: 0,
  };
}

const SKIP_REASON_LABELS: Record<AttendanceBonusSkipReason, string> = {
  bonus_not_configured: "Bono no configurado",
  joined_mid_period: "Ingresó a mitad del periodo",
  no_schedule: "Sin horario",
};

/** Motivo corto de un "No evaluado", para la columna Resultado de la pantalla Bonos. */
export function describeAttendanceBonusSkipReason(skipReason: AttendanceBonusSkipReason): string {
  return SKIP_REASON_LABELS[skipReason];
}
