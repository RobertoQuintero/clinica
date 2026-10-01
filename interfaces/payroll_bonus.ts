export type BonusKind = "punctuality" | "attendance";

/** 'C' | 'P' | 'N' en BD. `PunctualityBonusResult` es un alias de este tipo. */
export type BonusResult = "keeps" | "loses" | "not_evaluated";

/** Fila de configuración que dibujan la tarjeta y el modal genéricos. */
export interface IBonusSetting {
  id_payment_period:   number;
  clave_sat:           string;
  frequencyName:       string;
  monto:               number;
  maximo_incidencias?: number;          // solo puntualidad
  status:              boolean;
  updated_by_name:     string | null;   // null: la frecuencia no tiene fila
  updated_at:          string | null;   // "YYYY-MM-DD HH:mm:ss"
}

/** Fila de la bitácora genérica. Los campos de máximo solo vienen en puntualidad. */
export interface IBonusSettingsLogEntry {
  id_log:                       number;
  frequencyName:                string;
  monto_anterior:               number | null;
  monto_nuevo:                  number;
  maximo_incidencias_anterior?: number | null;
  maximo_incidencias_nuevo?:    number;
  status_anterior:              boolean | null;
  status_nuevo:                 boolean;
  updated_by_name:              string;
  updated_at:                   string;
}
