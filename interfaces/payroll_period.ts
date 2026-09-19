export type PayrollPeriodStatus = 1 | 2 | 3 | 4;

export interface IPayrollPeriod {
  id_period:          number;
  id_sucursal:        number;
  id_payment_period:  number;
  codigo:             string;
  ejercicio:          number;
  consecutivo:        number;
  fecha_inicio:       string;   // "YYYY-MM-DD"
  fecha_fin:          string;
  fecha_corte:        string;
  fecha_pago:         string;
  status:             PayrollPeriodStatus;
  created_by:         number;
  created_at:         string;   // "YYYY-MM-DD HH:mm:ss"
  updated_at:         string | null;
}

// Fila del listado: el periodo más la descripción de su frecuencia.
export interface IPayrollPeriodRow extends IPayrollPeriod {
  frecuencia_descripcion: string;
  frecuencia_clave_sat:   string;
}

export interface IPayrollPeriodDates {
  fecha_inicio: string;
  fecha_fin:    string;
  fecha_corte:  string;
  fecha_pago:   string;
}

export interface IPayrollPeriodFilters {
  idPaymentPeriod: number | null;              // pestaña de frecuencia
  status:          PayrollPeriodStatus | null;
  ejercicio:       number;
  search:          string;                     // coincidencia parcial por código
  page:            number;                     // base 1; 20 por página
}

export interface IPayrollPeriodsPage {
  rows:              IPayrollPeriodRow[];
  totalRows:         number;
  frequencyCounts:   { id_payment_period: number; description: string; total: number }[];
  availableYears:    number[];
  activePeriod:      IPayrollPeriodRow | null;  // tarjeta "Periodo activo en curso"
}
