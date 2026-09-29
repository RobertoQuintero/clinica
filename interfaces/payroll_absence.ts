import type { IScheduleDay } from "@/interfaces/employee_schedule";
import type { IPayrollPeriod } from "@/interfaces/payroll_period";

/** Sin fila en absence_justifications = "unjustified". */
export type AbsenceStatus = "unjustified" | "justified" | "not_applicable";

/** Resultado del helper puro para un empleado y un día detectado como falta. */
export interface IAbsenceDetection {
  fecha:        string;         // "YYYY-MM-DD"
  scheduledDay: IScheduleDay;   // siempre hay horario: sin horario no hay falta
}

/** Fila de la lista: detección en vivo + justificación guardada. */
export interface IAbsenceDayRow extends IAbsenceDetection {
  id_empleado:                number;
  codigo_empleado:            string;
  nombre_completo:            string;
  status:                     AbsenceStatus;
  url:                        string | null;
  mime_type:                  string | null;
  comentario:                 string | null;
  decided_by_name:            string | null;
  decided_at:                 string | null;    // "YYYY-MM-DD HH:mm:ss"
  discountedInPeriodCodes:    string[];         // "NOM-2026-S38" por cada tipo en que ya se descontó
}

export interface IAbsencePage {
  period:                   IPayrollPeriod | null;
  periodOptions:            Pick<IPayrollPeriod, "id_period" | "codigo" | "fecha_inicio" | "fecha_fin" | "status">[];
  canDecide:                boolean;           // periodo en estatus 1 o 2
  rows:                     IAbsenceDayRow[];  // ya filtradas y paginadas
  totalRows:                number;
  summary: { unjustifiedDays: number; justifiedDays: number; notApplicableDays: number };  // sin filtros
  employeesWithoutSchedule: { id_empleado: number; nombre_completo: string }[];
  recalculationNeeded:      boolean;           // solo puede ser true en estatus 2
}

/** Falta descontada, para la lista del Detalle. */
export interface IPayrollDiscountedAbsence {
  fecha: string;   // "YYYY-MM-DD"
}
