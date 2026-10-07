import type { IPayrollPeriod } from "@/interfaces/payroll_period";

export type ShiftExtensionAssignmentFilter = "all" | "assigned" | "unassigned";

export interface IShiftExtensionEmployeeRow {
  id_empleado:     number;
  codigo_empleado: string;
  nombre_completo: string;
  isAssigned:      boolean;
  scheduledDays:   number;   // días con horario en el rango del empleado
  workedDays:      number;   // días con horario y al menos una checada
  dailyRate:       number;   // salario_diario actual × 2 / 8, sin redondear
  estimatedAmount: number;   // 0 si no está asignado
}

export interface IShiftExtensionFilters {
  idPeriod:   number | null;
  assignment: ShiftExtensionAssignmentFilter;
  search:     string;
  page:       number;
}

export interface IShiftExtensionAssignmentLogEntry {
  id_log:          number;
  nombre_completo: string;
  activo_anterior: boolean | null;
  activo_nuevo:    boolean;
  updated_by_name: string;
  updated_at:      string;   // "YYYY-MM-DD HH:mm:ss"
}

export interface IShiftExtensionBonusPage {
  period:                   IPayrollPeriod | null;
  periodOptions:            Pick<IPayrollPeriod, "id_period" | "codigo" | "fecha_inicio" | "fecha_fin" | "status">[];
  rows:                     IShiftExtensionEmployeeRow[];
  totalRows:                number;
  summary:                  { assigned: number; estimatedAmount: number };
  employeesWithoutSchedule: { id_empleado: number; nombre_completo: string }[];
  recalculationNeeded:      boolean;
}
