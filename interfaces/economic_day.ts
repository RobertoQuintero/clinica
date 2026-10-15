/** Fila de RH.economic_days; fechas como string, nunca Date. */
export interface IEconomicDay {
  id_economic_day:    number;
  id_empleado:        number;
  fecha:              string;          // "YYYY-MM-DD"
  motivo:             string;
  created_by_name:    string | null;   // LEFT JOIN dbo.users
  created_at:         string;          // "YYYY-MM-DD HH:mm:ss"
  cancelado_by_name:  string | null;
  cancelado_at:       string | null;
  motivo_cancelacion: string | null;
}

/** Días de un año calendario, con su saldo. */
export interface IEconomicDaysYear {
  year:          number;
  usedDays:      number;   // no cancelados
  availableDays: number;   // ECONOMIC_DAYS_PER_YEAR - usedDays (mínimo 0)
  days:          IEconomicDay[];   // incluye cancelados, ordenados por fecha
}
