export type TerminationType = "R" | "D";

/** Fila de RH.cat_causas_baja (catálogo IMSS/IDSE). */
export interface ITerminationCause {
  clave: string;                          // '1'..'9' | 'A'
  nombre: string;
  tipo_terminacion_sugerido: TerminationType;
}

/** Fila de RH.employee_terminations con nombres resueltos; fechas como string, nunca Date. */
export interface IEmployeeTermination {
  id_employee_termination: number;
  id_empleado: number;
  fecha_baja: string;                     // "YYYY-MM-DD"
  clave_causa: string;
  nombre_causa: string;
  tipo_terminacion: TerminationType;
  observaciones: string | null;
  registrado_by: number;
  registrado_by_nombre: string;
  registrado_at: string;                  // "YYYY-MM-DD HH:mm:ss"
  anulado_by: number | null;
  anulado_by_nombre: string | null;
  anulado_at: string | null;
  motivo_anulacion: string | null;
}
