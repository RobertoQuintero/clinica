/** Estado del ISR de un renglón (spec 70): 'X' no aplica (operativa o snapshot previo), 'C' calculado, 'N' no calculado. */
export type IsrStatus = "X" | "C" | "N";

/** Por qué un renglón 'F' quedó en "ISR no calculado". */
export type IsrSkipReason =
  | "no_withholding_table"         // sin tarifa para la frecuencia y el ejercicio
  | "income_in_gap"                // la base cae en un hueco de la tarifa
  | "missing_subsidy_parameters";  // falta alguno de los 3 parámetros del subsidio vigentes a fecha_fin

/** Desglose del ISR congelado en `payroll.period_employees`. */
export interface IIsrBreakdown {
  isr_estado:                    IsrStatus;
  isr_motivo:                    IsrSkipReason | null;
  isr_base_gravable:             number | null;
  isr_ejercicio_tarifa:          number | null;
  isr_limite_inferior:           number | null;
  isr_cuota_fija:                number | null;
  isr_porcentaje_excedente:      number | null;
  isr_causado:                   number | null;
  subsidio_monto_mensual:        number | null;
  subsidio_monto_vigente_desde:  string | null;   // "YYYY-MM-DD"
  subsidio_tope_ingreso_mensual: number | null;
  subsidio_tope_vigente_desde:   string | null;
  subsidio_factor_dias_mes:      number | null;
  subsidio_factor_vigente_desde: string | null;
  subsidio_con_derecho:          boolean | null;
  subsidio_causado:              number | null;
  subsidio_aplicado:             number | null;
  isr_retenido:                  number | null;
}
