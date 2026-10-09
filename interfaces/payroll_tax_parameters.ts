export type TaxParameterKey =
  | "UMA_DIARIA" | "UMA_MENSUAL" | "UMA_ANUAL"
  | "SALARIO_MINIMO_GENERAL" | "SALARIO_MINIMO_FRONTERA"
  | "SUBSIDIO_MONTO_MENSUAL" | "SUBSIDIO_TOPE_INGRESO_MENSUAL" | "SUBSIDIO_FACTOR_DIAS_MES"
  | "DIAS_ANIO";

export interface ITaxParameter {
  id_tax_parameter: number;
  clave:            TaxParameterKey;
  valor:            number;
  vigente_desde:    string;   // "YYYY-MM-DD"
  updated_by_name:  string;
  updated_at:       string;   // "YYYY-MM-DD HH:mm:ss"
}

export interface IWithholdingBracket {
  id_tarifa:            number;
  ejercicio:            number;
  id_payment_period:    number;
  limite_inferior:      number;
  limite_superior:      number | null;   // null: tramo abierto
  cuota_fija:           number;
  porcentaje_excedente: number;
}

export type ExemptionLimitType = "N" | "T" | "U" | "P" | "M";
export type ExemptionPeriodicity = "D" | "S" | "M" | "A" | "E";

export interface IPerception {
  id_perception:        number;
  clave_sat:            string;
  description:          string;
  id_taxed_exempt:      number | null;
  tipo_limite_exencion: ExemptionLimitType;
  umas_limite:          number | null;
  porcentaje_exento:    number | null;
  periodicidad_limite:  ExemptionPeriodicity | null;
  is_billed:            boolean;
  status:               boolean;
}

export interface ITaxParametersLogEntry {
  id_log:          number;
  clave:           TaxParameterKey;
  vigente_desde:   string;
  valor_anterior:  number | null;
  valor_nuevo:     number | null;
  updated_by_name: string;
  updated_at:      string;
}
