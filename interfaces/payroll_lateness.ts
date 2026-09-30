import type { IPayrollPeriod, IPayrollPeriodRow } from "@/interfaces/payroll_period";

/** Sin fila en lateness_justifications = "unjustified". */
export type LatenessStatus = "unjustified" | "justified" | "not_applicable";
export type LatenessClassification = "severe" | "accumulable";   // 'G' | 'A' en BD

export interface ILatenessTier {
  id_payment_period: number;
  retardos:          number;
  dias_descuento:    number;   // múltiplo de 0.5
}

export interface ILatenessSettings {
  id_empresa:                   number;
  tolerancia_minutos:           number;
  minutos_retardo_grave:        number;
  dias_descuento_retardo_grave: number;
  tiers:                        ILatenessTier[];
  updated_by_name:              string;
  updated_at:                   string;   // "YYYY-MM-DD HH:mm:ss"
}

/** Una fila de la bitácora. Los campos "anterior" son null cuando no había configuración. */
export interface ILatenessSettingsLogEntry {
  id_log:                                 number;
  tolerancia_minutos_anterior:            number | null;
  tolerancia_minutos_nuevo:               number;
  minutos_retardo_grave_anterior:         number | null;
  minutos_retardo_grave_nuevo:            number;
  dias_descuento_retardo_grave_anterior:  number | null;
  dias_descuento_retardo_grave_nuevo:     number;
  escalones_anteriores:                   ILatenessTier[] | null;
  escalones_nuevos:                       ILatenessTier[];
  updated_by_name:                        string;
  updated_at:                             string;   // "YYYY-MM-DD HH:mm:ss"
}

/** Resultado del helper puro para un empleado y un día con retardo. */
export interface ILatenessDetection {
  fecha:          string;                  // "YYYY-MM-DD"
  hora_entrada_1: string;                  // "HH:mm"
  hora_llegada:   string;                  // "HH:mm:ss"
  minutos:        number;                  // truncado
  classification: LatenessClassification;
}

export interface ILatenessDayRow extends ILatenessDetection {
  id_empleado:             number;
  codigo_empleado:         string;
  nombre_completo:         string;
  status:                  LatenessStatus;
  url:                     string | null;
  mime_type:               string | null;
  comentario:              string | null;
  decided_by_name:         string | null;
  decided_at:              string | null;   // "YYYY-MM-DD HH:mm:ss"
  discountedInPeriodCodes: string[];        // "NOM-2026-S38" por cada tipo en que ya se descontó
}

export interface ILatenessEmployeeSummary {
  id_empleado:      number;
  nombre_completo:  string;
  severeCount:      number;   // injustificados, no descontados por otro periodo
  accumulableCount: number;
  estimatedDays:    number;   // antes del tope
}

export interface ILatenessFilters {
  idPeriod:       number | null;   // null: periodo vigente, o el más reciente
  status:         "all" | LatenessStatus;
  classification: "all" | LatenessClassification;
  search:         string;
  page:           number;
}

export interface ILatenessPage {
  period:                   IPayrollPeriodRow | null;
  periodOptions:            Pick<IPayrollPeriod, "id_period" | "codigo" | "fecha_inicio" | "fecha_fin" | "status">[];
  canDecide:                boolean;
  settings:                 ILatenessSettings | null;   // null: la empresa no tiene configuración
  periodHasTiers:           boolean;                    // false → aviso "Sin escalones para {frecuencia}"
  rows:                     ILatenessDayRow[];
  totalRows:                number;
  summary: { severeUnjustified: number; accumulableUnjustified: number; justified: number; notApplicable: number };
  employeeSummaries:        ILatenessEmployeeSummary[];
  employeesWithoutSchedule: { id_empleado: number; nombre_completo: string }[];
  recalculationNeeded:      boolean;
}

/** Retardo descontado, para la lista del Detalle. */
export interface IPayrollDiscountedLateness {
  fecha:           string;
  hora_entrada_1:  string;
  hora_llegada:    string;
  minutos_retardo: number;
  classification:  LatenessClassification;
}
