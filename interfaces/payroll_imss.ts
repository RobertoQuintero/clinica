/** Estado del IMSS de un renglón (spec 91): 'X' no aplica, 'C' calculado, 'N' no calculado. */
export type ImssStatus = "X" | "C" | "N";

/** Por qué un renglón 'F' de régimen 02 quedó en "IMSS no calculado". Se revisan en este orden. */
export type ImssSkipReason =
  | "missing_nss"
  | "missing_sbc"
  | "missing_uma"
  | "missing_imss_parameters"
  | "missing_minimum_wage";

/** Desglose congelado en `payroll.period_employee_imss`: una propiedad por columna, fechas como "YYYY-MM-DD". */
export interface IImssBreakdown {
  // Datos usados, con su vigencia
  sbc:                          number;
  sbc_vigente_desde:            string;
  uma_diaria:                   number;
  uma_vigente_desde:            string;
  salario_minimo:               number;
  salario_minimo_vigente_desde: string;
  parametros_vigente_desde:     string;   // el vigente_desde más reciente de las 7 claves IMSS
  tope_sbc_umas:                number;
  umbral_excedente_umas:        number;
  // Bases
  tope_sbc:                     number;   // ROUND(tope_sbc_umas × uma, 2)
  sbc_topado:                   number;   // min(sbc, tope_sbc)
  umbral_excedente:             number;   // ROUND(umbral_excedente_umas × uma, 2)
  excedente_diario:             number;   // max(0, sbc_topado − umbral_excedente)
  dias_eym:                     number;   // dias + dias_falta
  dias_iv_ceav:                 number;   // dias
  // Ramos: tasa en % (congelada) e importe = ROUND(base × días × tasa / 100, 2)
  tasa_eym_excedente:           number;
  importe_eym_excedente:        number;
  tasa_eym_dinero:              number;
  importe_eym_dinero:           number;
  tasa_eym_pensionados:         number;
  importe_eym_pensionados:      number;
  tasa_iv:                      number;
  importe_iv:                   number;
  tasa_ceav:                    number;
  importe_ceav:                 number;
  // Resultado
  cuota_causada:                number;   // suma de los 5 importes
  exento_salario_minimo:        boolean;  // art. 36 LSS
  tope_neto:                    number;   // max(0, percepciones − ISR retenido)
  topado_al_neto:               boolean;
  imss_retenido:                number;
}

/** Las filas de Procesar ganan estos tres campos; el Detalle gana `imss: IImssBreakdown | null`. */
export interface IImssRowSummary {
  imss_estado:    ImssStatus;
  imss_motivo:    ImssSkipReason | null;   // solo 'N'
  imss_retenido:  number | null;           // solo 'C'
}
