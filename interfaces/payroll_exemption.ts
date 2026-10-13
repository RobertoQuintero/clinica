import type { ExemptionLimitType, ExemptionPeriodicity } from "@/interfaces/payroll_tax_parameters";

/** Estado del exento de un renglón de percepción (spec 73): 'C' calculado, 'N' no calculado. */
export type ExemptionStatus = "C" | "N";

/** Por qué un renglón de percepción quedó en "Exento no calculado". */
export type ExemptionSkipReason = "missing_uma" | "unsupported_frequency";

/** Una percepción de un renglón fiscal, con su gravado, su exento y la regla congelada del catálogo. */
export interface IPeriodEmployeePerception {
  id_perception:           number;
  clave_sat:               string;
  description:             string;
  importe:                 number;
  eventos:                 number | null;
  exencion_estado:         ExemptionStatus;
  exencion_motivo:         ExemptionSkipReason | null;
  tipo_limite_exencion:    ExemptionLimitType;
  umas_limite:             number | null;
  porcentaje_exento:       number | null;
  periodicidad_limite:     ExemptionPeriodicity | null;
  uma_diaria:              number | null;
  uma_vigente_desde:       string | null;   // "YYYY-MM-DD"
  tope_exento:             number | null;
  exento_consumido_previo: number | null;
  importe_exento:          number | null;
  importe_gravado:         number | null;
}
