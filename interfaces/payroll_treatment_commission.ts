export interface ITreatmentCommissionSettings {
  importe_por_tratamiento: number;
  umbral_liquidacion:      number;
  updated_by_nombre:       string;
  updated_at:              string;   // "YYYY-MM-DD HH:mm:ss"
}

export interface ITreatmentCommissionSettingsInput {
  importe_por_tratamiento: number;
  umbral_liquidacion:      number;
}

export interface ITreatmentCommissionSettingsLogEntry {
  id_log:                           number;
  importe_por_tratamiento_anterior: number | null;
  importe_por_tratamiento_nuevo:    number;
  umbral_liquidacion_anterior:      number | null;
  umbral_liquidacion_nuevo:         number;
  updated_by_nombre:                string;
  updated_at:                       string;   // "YYYY-MM-DD HH:mm:ss"
}

/** Tratamiento pagado en un renglón de nómina, para la lista del detalle. */
export interface IPayrollPaidTreatment {
  id_tratamiento:    number;
  nombre_paciente:   string;
  fecha_liquidacion: string;   // "YYYY-MM-DD HH:mm:ss"
  total_parciales:   number;
}
