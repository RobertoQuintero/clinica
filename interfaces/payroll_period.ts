export type PayrollPeriodStatus = 1 | 2 | 3 | 4;

// Spec 87: 'O' ordinaria (por frecuencia), 'E' extraordinaria (aguinaldo anual).
export type PayrollPeriodType = "O" | "E";

// Spec 90: lo que paga un periodo extraordinario. 'A' aguinaldo, 'P' PTU. Es null en los ordinarios.
export type ExtraordinaryConcept = "A" | "P";

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
  tipo_periodo:       PayrollPeriodType;
  concepto_extraordinario: ExtraordinaryConcept | null;
  created_by:        number;
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
