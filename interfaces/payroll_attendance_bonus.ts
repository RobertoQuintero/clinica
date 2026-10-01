import type { BonusResult, IBonusSetting, IBonusSettingsLogEntry } from "@/interfaces/payroll_bonus";
import type { IPayrollPeriod } from "@/interfaces/payroll_period";

/** Por qué un empleado no se evalúa. */
export type AttendanceBonusSkipReason =
  | "bonus_not_configured"   // frecuencia sin fila o con status = 0
  | "joined_mid_period"      // fecha_ingreso > fecha_inicio
  | "no_schedule";           // sin filas en RH.empleado_horarios

export type IAttendanceBonusSetting = Omit<IBonusSetting, "maximo_incidencias">;
export type IAttendanceBonusSettingsLogEntry =
  Omit<IBonusSettingsLogEntry, "maximo_incidencias_anterior" | "maximo_incidencias_nuevo">;

/** Resultado del helper puro para un empleado en un periodo. */
export interface IAttendanceBonusEvaluation {
  absenceCount: number;                              // faltas injustificadas
  result:       BonusResult;
  skipReason:   AttendanceBonusSkipReason | null;    // solo con not_evaluated
  amount:       number;                              // monto o 0
}

export interface IAttendanceBonusEmployeeRow extends IAttendanceBonusEvaluation {
  id_empleado:     number;
  codigo_empleado: string;
  nombre_completo: string;
}

export interface IAttendanceBonusFilters {
  idPeriod: number | null;
  result:   "all" | BonusResult;
  search:   string;
  page:     number;
}

export interface IAttendanceBonusPage {
  period:                   IPayrollPeriod | null;
  periodOptions:            Pick<IPayrollPeriod, "id_period" | "codigo" | "fecha_inicio" | "fecha_fin" | "status">[];
  settings:                 IAttendanceBonusSetting[];        // una por frecuencia activa, con o sin fila
  periodSetting:            IAttendanceBonusSetting | null;   // la de la frecuencia del periodo
  rows:                     IAttendanceBonusEmployeeRow[];
  totalRows:                number;
  summary: { keeps: number; loses: number; notEvaluated: number; estimatedAmount: number };
  employeesWithoutSchedule: { id_empleado: number; nombre_completo: string }[];
  recalculationNeeded:      boolean;
}
