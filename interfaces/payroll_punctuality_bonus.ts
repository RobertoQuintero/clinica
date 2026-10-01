import type { IPayrollPeriod } from "@/interfaces/payroll_period";

/** 'C' | 'P' | 'N' en BD. */
export type PunctualityBonusResult = "keeps" | "loses" | "not_evaluated";

/** Por qué un empleado no se evalúa. Las dos primeras aplican a todo el periodo. */
export type PunctualityBonusSkipReason =
  | "no_lateness_settings"      // la empresa no tiene lateness_settings
  | "bonus_not_configured"      // frecuencia sin fila o con status = 0
  | "joined_mid_period"         // fecha_ingreso > fecha_inicio
  | "no_schedule";              // sin filas en RH.empleado_horarios

export interface IPunctualityBonusSetting {
  id_payment_period:  number;
  clave_sat:          string;
  frequencyName:      string;         // descripción de RH.payment_periods
  monto:              number;
  maximo_incidencias: number;
  status:             boolean;
  updated_by_name:    string | null;  // null: la frecuencia no tiene fila
  updated_at:         string | null;  // "YYYY-MM-DD HH:mm:ss"
}

export interface IPunctualityBonusSettingsLogEntry {
  id_log:                      number;
  frequencyName:               string;
  monto_anterior:              number | null;
  monto_nuevo:                 number;
  maximo_incidencias_anterior: number | null;
  maximo_incidencias_nuevo:    number;
  status_anterior:             boolean | null;
  status_nuevo:                boolean;
  updated_by_name:             string;
  updated_at:                  string;
}

/** Resultado del helper puro para un empleado en un periodo. */
export interface IPunctualityBonusEvaluation {
  lateCount:        number;                            // retardos injustificados (graves + acumulables)
  absenceCount:     number;                            // faltas injustificadas
  incidentCount:    number;                            // lateCount + absenceCount
  maximumIncidents: number | null;                     // null si not_evaluated
  result:           PunctualityBonusResult;
  skipReason:       PunctualityBonusSkipReason | null; // solo con not_evaluated
  amount:           number;                            // monto o 0
}

export interface IPunctualityBonusEmployeeRow extends IPunctualityBonusEvaluation {
  id_empleado:     number;
  codigo_empleado: string;
  nombre_completo: string;
}

export interface IPunctualityBonusFilters {
  idPeriod: number | null;
  result:   "all" | PunctualityBonusResult;
  search:   string;
  page:     number;
}

export interface IPunctualityBonusPage {
  period:                   IPayrollPeriod | null;
  periodOptions:            Pick<IPayrollPeriod, "id_period" | "codigo" | "fecha_inicio" | "fecha_fin" | "status">[];
  settings:                 IPunctualityBonusSetting[];        // una por frecuencia activa, con o sin fila
  periodSetting:            IPunctualityBonusSetting | null;   // la de la frecuencia del periodo
  hasLatenessSettings:      boolean;
  rows:                     IPunctualityBonusEmployeeRow[];
  totalRows:                number;
  summary: { keeps: number; loses: number; notEvaluated: number; estimatedAmount: number };
  employeesWithoutSchedule: { id_empleado: number; nombre_completo: string }[];
  recalculationNeeded:      boolean;
}
