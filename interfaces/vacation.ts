export type VacationStatus =
  | "pendiente" | "programada" | "en_curso" | "tomada" | "por_pagar" | "pagada";

export type VacationLogAction = "C" | "R" | "X" | "P" | "V";

/** Fila de RH.vacation_entitlements; todas las fechas como "YYYY-MM-DD", nunca Date. */
export interface IVacationEntitlement {
  id_vacation_entitlement:     number;
  id_empleado:                 number;
  anio_servicio:               number;
  fecha_aniversario:           string;
  fecha_limite_solicitud:      string;
  fecha_siguiente_aniversario: string;
  dias_derecho:                number;
  fecha_inicio:                string | null;
  fecha_fin:                   string | null;
  dias_tomados:                number | null;
  solicitado_at:               string | null;   // "YYYY-MM-DD HH:mm:ss"
  fecha_pago:                  string | null;
  dias_pagados:                number | null;
  comentario_pago:             string | null;
}

export interface IVacationLogEntry {
  id_log:                number;
  accion:                VacationLogAction;
  fecha_inicio_anterior: string | null;
  fecha_fin_anterior:    string | null;
  dias_tomados_anterior: number | null;
  fecha_inicio_nueva:    string | null;
  fecha_fin_nueva:       string | null;
  dias_tomados_nueva:    number | null;
  fecha_pago:            string | null;
  dias_pagados:          number | null;
  motivo:                string | null;
  created_by_name:       string | null;   // LEFT JOIN dbo.users
  created_at:            string;
}

export type VacationPayConcept = "P" | "D";
export type VacationPremiumStatus = "pagada" | "pendiente" | "sin_evento";

/** Un concepto pagado por la nómina para un año de derecho (lectura de period_employee_vacations + periods). */
export interface IVacationPayrollPayment {
  concepto:       VacationPayConcept;
  tipo_nomina:    "O" | "F";
  id_period:      number;
  codigo_periodo: string;   // "NOM-2026-S38"
}

/** Año de derecho + estatus derivado + bitácora, para la pestaña y el badge. */
export interface IVacationEntitlementView extends IVacationEntitlement {
  status:         VacationStatus;
  dias_por_pagar: number;          // dias_derecho - dias_tomados cuando aplica; 0 si no
  log:            IVacationLogEntry[];
  payroll_payments:     IVacationPayrollPayment[];   // spec 78
  premium_status:       VacationPremiumStatus;
  paid_days_in_payroll: boolean;                     // dias_pagados ya entró a algún periodo calculado
}

/** Estatus del año vigente listo para pintar el badge (expediente y listado). */
export interface IVacationBadgeSummary {
  status:   VacationStatus;
  label:    string;
  /** `pendiente` con 30 días o menos para la fecha límite: el badge va en ámbar. */
  isUrgent: boolean;
}
