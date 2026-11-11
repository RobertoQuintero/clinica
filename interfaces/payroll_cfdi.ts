/**
 * Estado del recibo de CFDI de nómina (spec 98/99). 'P' reservado antes de llamar a Facturapi;
 * 'X' reservado antes de llamar a Facturapi para cancelar; 'C' nunca es un recibo vigente.
 */
export type PayrollCfdiStatus = "P" | "T" | "E" | "X" | "C";

/** Motivo de cancelación ante el SAT permitido en esta spec (sin `01`/sustitución). */
export type PayrollCfdiCancellationMotive = "02" | "03";

/** Espejo de `payroll.period_employee_cfdi`; fechas como string, nunca `Date`. */
export interface IPayrollCfdiReceipt {
  id_period_employee_cfdi:   number;
  id_period_employee:        number | null;
  id_period:                 number;
  id_empleado:                number;
  livemode:                  boolean;
  estado:                    PayrollCfdiStatus;
  org_uid:                   string;
  facturapi_id:              string | null;
  uuid:                      string | null;
  serie:                     string | null;
  folio:                     number | null;
  total:                     number | null;
  fecha_timbrado:            string | null;   // "YYYY-MM-DD HH:mm:ss"
  mensaje_error:             string | null;
  stamped_by:                number;
  motivo_cancelacion:        PayrollCfdiCancellationMotive | null;
  cancelacion_solicitada_at: string | null;   // "YYYY-MM-DD HH:mm:ss"
  fecha_cancelacion:         string | null;   // "YYYY-MM-DD HH:mm:ss"
  cancelled_by:              number | null;
  created_at:                string;          // "YYYY-MM-DD HH:mm:ss"
  updated_at:                string;
}

/** Por qué una fila no es timbrable todavía; [] en `getPayrollStampingBlockReasons` = timbrable. */
export type PayrollStampingBlockReason =
  | "employee_fiscal_data"
  | "isr_not_calculated"
  | "imss_not_calculated"
  | "exemption_not_calculated"
  | "no_payroll_issuer"
  | "issuer_without_certificate"
  | "period_not_paid"
  | "period_not_ordinary";

/** Estado visual de la columna "CFDI" en Procesar nómina y de la tarjeta del Detalle. */
export interface PayrollCfdiRowState {
  status:
    | "pendiente"
    | "bloqueado"
    | "en_proceso"
    | "timbrado"
    | "prueba"
    | "error"
    | "cancelacion_en_proceso";
  reasons?: PayrollStampingBlockReason[];
  receipt?: IPayrollCfdiReceipt;
}

/** El emisor que timbraría hoy, para la confirmación de "Timbrar pendientes" y el aviso de la tabla. */
export interface PayrollIssuerSummary {
  active:         boolean;
  hasCertificate: boolean;
  name:           string | null;
  isLive:         boolean;
}

/** Recibo cancelado de un periodo, para el historial del Detalle del empleado (spec 99). */
export interface PayrollCfdiCancelledReceipt {
  idReceipt:          number;          // id_period_employee_cfdi, para los links de XML/PDF/acuse
  uuid:               string;
  serieFolio:         string;          // "NOM-{folio}"
  livemode:           boolean;
  motivoCancelacion:  PayrollCfdiCancellationMotive;
  fechaCancelacion:   string;          // "YYYY-MM-DD HH:mm:ss"
  cancelledByName:    string;
}
