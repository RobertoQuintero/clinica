import { IScheduleDay } from "@/interfaces/employee_schedule";
import { IPayrollPeriod } from "@/interfaces/payroll_period";

/** Lo que el admin decidió; sin fila en BD = "pending". */
export type OvertimeDecisionStatus = "pending" | "authorized" | "rejected";

export interface IOvertimeSettings {
  id_empresa:                  number;
  limite_horas_dobles_periodo: number;
  tope_horas_dia:              number;
  updated_by:                  number;
  updated_at:                  string;   // "YYYY-MM-DD HH:mm:ss"
}

export interface IOvertimeSettingsLogEntry {
  id_log:                               number;
  limite_horas_dobles_periodo_anterior: number | null;
  limite_horas_dobles_periodo_nuevo:    number;
  tope_horas_dia_anterior:              number | null;
  tope_horas_dia_nuevo:                 number;
  updated_by_name:                      string;
  updated_at:                           string;
}

/** Resultado del helper puro para un empleado y un día. */
export interface IOvertimeDetection {
  fecha:           string;               // "YYYY-MM-DD"
  scheduledDay:    IScheduleDay | null;  // null = descanso
  firstCheckIn:    string | null;        // "HH:mm"
  lastCheckOut:    string | null;        // "HH:mm"
  isIncomplete:    boolean;
  detectedHours:   number;               // múltiplo de 0.5; 0 si incompleto
}

/** Fila de la lista: detección en vivo + decisión guardada. */
export interface IOvertimeDayRow extends IOvertimeDetection {
  id_empleado:                number;
  codigo_empleado:            string;
  nombre_completo:            string;
  status:                     OvertimeDecisionStatus;
  authorizedHours:            number | null;
  detectedHoursAtDecision:    number | null;   // para la marca "Detectado cambió"
  comentario:                 string | null;
  decided_by_name:            string | null;
  decided_at:                 string | null;
}

export interface IOvertimePage {
  period:                  IPayrollPeriod | null;
  periodOptions:           Pick<IPayrollPeriod, "id_period" | "codigo" | "fecha_inicio" | "fecha_fin" | "status">[];
  canDecide:               boolean;             // periodo en estatus 1 o 2
  rows:                    IOvertimeDayRow[];   // ya filtradas y paginadas
  totalRows:               number;
  summary: { pendingDays: number; detectedHours: number; authorizedHours: number };  // sin filtros
  employeesWithoutSchedule: { id_empleado: number; nombre_completo: string }[];
  settings:                IOvertimeSettings | null;
}

export type OvertimeStatusFilter = "all" | OvertimeDecisionStatus;

/** Filtros de la pantalla, todos vienen de la URL. */
export interface IOvertimeFilters {
  idPeriod: number | null;   // null: periodo vigente, o el más reciente
  status:   OvertimeStatusFilter;
  search:   string;          // nombre o código, coincidencia parcial
  page:     number;          // desde 1
}
