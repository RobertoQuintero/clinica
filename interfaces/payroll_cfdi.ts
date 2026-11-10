/** Estado del recibo de CFDI de nómina (spec 98). 'P' = reservado antes de llamar a Facturapi. */
export type PayrollCfdiStatus = "P" | "T" | "E";

/** Espejo de `payroll.period_employee_cfdi`; fechas como string, nunca `Date`. */
export interface IPayrollCfdiReceipt {
  id_period_employee_cfdi: number;
  id_period_employee:      number;
  livemode:                boolean;
  estado:                  PayrollCfdiStatus;
  org_uid:                 string;
  facturapi_id:            string | null;
  uuid:                    string | null;
  serie:                   string | null;
  folio:                   number | null;
  total:                   number | null;
  fecha_timbrado:          string | null;   // "YYYY-MM-DD HH:mm:ss"
  mensaje_error:           string | null;
  stamped_by:              number;
  created_at:              string;          // "YYYY-MM-DD HH:mm:ss"
  updated_at:               string;
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
  status: "pendiente" | "bloqueado" | "en_proceso" | "timbrado" | "prueba" | "error";
  reasons?: PayrollStampingBlockReason[];
  receipt?: IPayrollCfdiReceipt;
}
