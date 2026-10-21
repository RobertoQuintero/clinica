import type { Article174SkipReason } from "@/interfaces/payroll_christmas_bonus";
import type { ExtraordinaryConcept, PayrollPeriodType } from "@/interfaces/payroll_period";
import type { ExemptionSkipReason } from "@/interfaces/payroll_exemption";
import type { ImssSkipReason } from "@/interfaces/payroll_imss";
import type { IsrSkipReason } from "@/interfaces/payroll_isr";
import type { TaxParameterKey } from "@/interfaces/payroll_tax_parameters";
import type {
  PtuCategory,
  PtuDistributionStatus,
  PtuIneligibilityReason,
  PtuLogAction,
  PtuTaxpayerType,
  PtuThreeMonthsFactor,
} from "@/interfaces/payroll_ptu";

export const PAYROLL_PERIOD_STATUS = {
  1: { label: "Programada",  badge: "neutral" },
  2: { label: "En cálculo",  badge: "info" },
  3: { label: "Aprobada",    badge: "warning" },
  4: { label: "Pagada",      badge: "success" },
} as const;

export const PAYROLL_TYPE = {
  O: { label: "Operativa", urlValue: "operativa" },
  F: { label: "Fiscal",    urlValue: "fiscal" },
} as const;

// clave_sat -> letra del código. Las frecuencias fuera de este mapa no se ofrecen.
export const PAYROLL_FREQUENCY_LETTER_BY_SAT_KEY: Record<string, string> = {
  "01": "D", "02": "S", "03": "C", "04": "Q", "05": "M", "06": "B", "10": "X",
};

export const PAYROLL_PERIODS_PAGE_SIZE = 20;
export const OVERTIME_PAGE_SIZE = 25;
export const PAYROLL_ALLOWED_ROLE_IDS = [1, 4];
export const ABSENCE_PAGE_SIZE = 25;
// Roles de usuario (dbo.users.id_role) cuyo empleado vinculado queda sujeto al control de faltas (spec 62). 2 = podólogo.
export const ABSENCE_CONTROL_ROLE_IDS = [2];

export const LATENESS_PAGE_SIZE = 25;
export const PUNCTUALITY_BONUS_PAGE_SIZE = 25;
export const ATTENDANCE_BONUS_PAGE_SIZE = 25;

// Bono por extensión de jornada (spec 68): (salario_diario / 8) × 2 por día con horario y checada.
export const SHIFT_EXTENSION_HOURS_PER_DAY = 1;
export const SHIFT_EXTENSION_PAY_MULTIPLIER = 2;
export const SHIFT_EXTENSION_BONUS_PAGE_SIZE = 25;

// Parámetros fiscales anuales (spec 69, más las 7 del IMSS de la spec 91). Las claves de payroll.tax_parameters, con etiqueta y unidad para la pantalla.
export const TAX_PARAMETER_KEYS: Record<TaxParameterKey, { label: string; unit: string }> = {
  UMA_DIARIA:                    { label: "UMA diaria",                        unit: "$ por día" },
  UMA_MENSUAL:                   { label: "UMA mensual",                       unit: "$ por mes" },
  UMA_ANUAL:                     { label: "UMA anual",                         unit: "$ por año" },
  SALARIO_MINIMO_GENERAL:        { label: "Salario mínimo general",            unit: "$ por día" },
  SALARIO_MINIMO_FRONTERA:       { label: "Salario mínimo zona fronteriza",    unit: "$ por día" },
  SUBSIDIO_MONTO_MENSUAL:        { label: "Subsidio para el empleo (monto)",   unit: "$ por mes" },
  SUBSIDIO_TOPE_INGRESO_MENSUAL: { label: "Subsidio para el empleo (tope de ingreso)", unit: "$ por mes" },
  SUBSIDIO_FACTOR_DIAS_MES:      { label: "Subsidio para el empleo (factor de días)",  unit: "días" },
  DIAS_ANIO:                     { label: "Días del año",                      unit: "días" },
  // Spec 91: cuota obrera del IMSS. Tasas en porcentaje (0.4 = 0.40 %); umbral y tope en UMA.
  IMSS_OBRERO_EYM_EXCEDENTE:     { label: "IMSS obrero: enfermedad y maternidad, excedente de 3 UMA", unit: "% del excedente" },
  IMSS_OBRERO_EYM_DINERO:        { label: "IMSS obrero: enfermedad y maternidad, prestaciones en dinero", unit: "% del SBC" },
  IMSS_OBRERO_EYM_PENSIONADOS:   { label: "IMSS obrero: enfermedad y maternidad, gastos médicos de pensionados", unit: "% del SBC" },
  IMSS_OBRERO_IV:                { label: "IMSS obrero: invalidez y vida",     unit: "% del SBC" },
  IMSS_OBRERO_CEAV:              { label: "IMSS obrero: cesantía en edad avanzada y vejez", unit: "% del SBC" },
  IMSS_UMBRAL_EXCEDENTE_UMAS:    { label: "IMSS: umbral del excedente",        unit: "UMA" },
  IMSS_TOPE_SBC_UMAS:            { label: "IMSS: tope del SBC",                unit: "UMA" },
};
export const TAX_PARAMETERS_LOG_PAGE_SIZE = 20;
export const EMPLOYEE_SBC_LOG_PAGE_SIZE = 20;

// ISR de la nómina fiscal (spec 70). id_deduction del ISR en el catálogo payroll.deductions (clave SAT 002).
export const ISR_DEDUCTION_ID = 2;
export const ISR_SKIP_REASON_LABELS: Record<IsrSkipReason, string> = {
  no_withholding_table:       "No hay tarifa de retención para la frecuencia y el ejercicio del periodo",
  income_in_gap:              "El ingreso cae en un hueco de la tarifa de retención",
  missing_subsidy_parameters: "Faltan parámetros del subsidio para el empleo vigentes al fin del periodo",
  exemption_not_calculated:   "Alguna percepción no tiene su gravado y exento calculados, así que la base del ISR es desconocida",
};

// IMSS de la nómina fiscal (spec 91). id_deduction de Seguridad social en payroll.deductions (clave SAT 001).
export const IMSS_DEDUCTION_ID = 1;
// RH.empleados.tipo_regimen del que sí se retiene IMSS: 02 = sueldos.
export const IMSS_CONTRIBUTION_REGIME = "02";
// Si falta alguna vigente a fecha_fin, el motivo es missing_imss_parameters.
export const IMSS_TAX_PARAMETER_KEYS = [
  "IMSS_OBRERO_EYM_EXCEDENTE",
  "IMSS_OBRERO_EYM_DINERO",
  "IMSS_OBRERO_EYM_PENSIONADOS",
  "IMSS_OBRERO_IV",
  "IMSS_OBRERO_CEAV",
  "IMSS_UMBRAL_EXCEDENTE_UMAS",
  "IMSS_TOPE_SBC_UMAS",
] as const satisfies readonly TaxParameterKey[];
export const IMSS_SKIP_REASON_LABELS: Record<ImssSkipReason, string> = {
  missing_nss:             "El empleado no tiene NSS capturado",
  missing_sbc:             "El empleado no tiene un SBC vigente al fin del periodo",
  missing_uma:             "Falta la UMA diaria vigente al fin del periodo",
  missing_imss_parameters: "Falta alguna tasa o límite del IMSS vigente al fin del periodo",
  missing_minimum_wage:    "Falta el salario mínimo general vigente al fin del periodo",
};

// Gravado/exento de la nómina fiscal (spec 73). id_perception del sueldo en el catálogo payroll.perceptions.
export const SALARY_PERCEPTION_ID = 1;
// Spec 74: horas extra en el catálogo payroll.perceptions. Las dos son clave SAT 019;
// las dobles llevan exención ('M' 50%, 5 UMA por semana) y las triples son 100% gravadas ('N').
export const OVERTIME_DOUBLE_PERCEPTION_ID = 5;
export const OVERTIME_TRIPLE_PERCEPTION_ID = 13;
// Spec 78: prima vacacional (ya existía en el catálogo) y días no disfrutados pagados.
export const VACATION_PREMIUM_PERCEPTION_ID = 7;    // 021, 'U' 15 UMA por año
export const PAID_VACATION_PERCEPTION_ID    = 14;   // 001, 'N' 100% gravada
export const VACATION_PREMIUM_PERCENT       = 25;   // LFT art. 80
// Spec 87: aguinaldo anual en nómina extraordinaria.
export const CHRISTMAS_BONUS_PERCEPTION_ID = 2;     // 002, 'U' 30 UMA por año (confirmado por el script de datos)
export const CHRISTMAS_BONUS_DAYS = 15;
export const CHRISTMAS_BONUS_YEAR_DAYS = 365;       // fijo, también en año bisiesto
export const CHRISTMAS_BONUS_DEADLINE_MONTH_DAY = "12-20";
export const CHRISTMAS_BONUS_WARNING_START_MONTH_DAY = "12-01";
export const ARTICLE_174_MONTH_DAYS_FACTOR = 30.4;  // fijado por el art. 174 RLISR

export const PAYROLL_PERIOD_TYPE_LABELS: Record<PayrollPeriodType, string> = {
  O: "Ordinaria",
  E: "Extraordinaria",
};
export const EXTRAORDINARY_CONCEPT_LABELS: Record<ExtraordinaryConcept, string> = {
  A: "Aguinaldo",
  P: "PTU",
};

// Spec 90: pago de la PTU en nómina extraordinaria.
export const PTU_PERCEPTION_ID = 3;                 // 003, 'U' 15 UMA por año (confirmado por el script de datos)
export const PTU_PERCEPTION_SAT_KEY = "003";
export const PTU_PAYMENT_DEADLINE_MONTH_DAY: Record<PtuTaxpayerType, string> = {
  M: "05-30",   // 60 días después del 31-mar (declaración de persona moral)
  F: "06-29",   // 60 días después del 30-abr (declaración de persona física)
};
export const PTU_PAYMENT_WARNING_DAYS = 30;
export const EXTRAORDINARY_PERIOD_SAT_KEY = "99";
export const EXTRAORDINARY_PERIOD_CODE_LETTER = "E";
export const MONTHLY_WITHHOLDING_SAT_KEY = "05";

export const ARTICLE_174_SKIP_REASON_LABELS: Record<Article174SkipReason, string> = {
  no_monthly_withholding_table: "No hay tarifa mensual de ISR para el año",
  income_in_gap:                "El ingreso cae en un hueco de la tarifa mensual",
  exemption_not_calculated:     "No se pudo calcular el exento del aguinaldo",
};

// id_perception -> clave de la línea de buildPerceptionLines que lo representa en el Detalle.
// Cada spec de percepción nueva agrega su entrada.
export const PERCEPTION_LINE_KEY_BY_ID: Record<number, string> = {
  [SALARY_PERCEPTION_ID]:          "sueldo_base",
  [OVERTIME_DOUBLE_PERCEPTION_ID]: "horas_extra_dobles",
  [OVERTIME_TRIPLE_PERCEPTION_ID]: "horas_extra_triples",
  [VACATION_PREMIUM_PERCEPTION_ID]: "prima_vacacional",
  [PAID_VACATION_PERCEPTION_ID]:    "vacaciones_pagadas",
  [CHRISTMAS_BONUS_PERCEPTION_ID]:  "aguinaldo",
  [PTU_PERCEPTION_ID]:              "ptu",
};
export const EXEMPTION_SKIP_REASON_LABELS: Record<ExemptionSkipReason, string> = {
  missing_uma:           "No hay UMA diaria vigente al fin del periodo",
  unsupported_frequency: "El tope semanal solo se calcula en periodos de frecuencia semanal",
};

export const PTU_CATEGORY_LABELS: Record<PtuCategory, string> = {
  N: "Normal",
  C: "Confianza (tope 120%)",
  X: "Excluido (director, administrador o gerente general)",
};

export const PTU_PROFIT_SHARE_PERCENT = 10;
export const PTU_THREE_MONTHS_FACTORS: readonly PtuThreeMonthsFactor[] = [90, 91.25];
export const PTU_EVENTUAL_MINIMUM_DAYS = 60;
export const PTU_TRUST_SALARY_CAP_FACTOR = 1.2;
export const PTU_PERMANENT_CONTRACT_TYPE = "01";   // c_TipoContrato: tiempo indeterminado
export const PTU_AVERAGE_YEARS = 3;

export const PTU_INELIGIBILITY_REASON_LABELS: Record<PtuIneligibilityReason, string> = {
  excluded_category:      "Excluido: director, administrador o gerente general",
  eventual_under_60_days: "Eventual con menos de 60 días",
  no_days:                "Sin días trabajados",
};
export const PTU_DISTRIBUTION_STATUS_LABELS: Record<PtuDistributionStatus, string> = { B: "Borrador", C: "Cerrado" };
export const PTU_TAXPAYER_TYPE_LABELS: Record<PtuTaxpayerType, string> = { M: "Persona moral", F: "Persona física" };

export const PTU_LOG_ENTRIES_LIMIT = 20;
export const PTU_LOG_ACTION_LABELS: Record<PtuLogAction, string> = {
  P: "Parámetros",
  R: "Precarga",
  A: "Trabajador agregado",
  Q: "Trabajador quitado",
  E: "Edición de fila",
  H: "Historial de PTU",
  C: "Cierre",
  O: "Reapertura",
};
/** Campo de la bitácora -> etiqueta. `type` decide cómo se muestra el valor. */
export const PTU_LOG_FIELD_LABELS: Record<string, { label: string; type: "text" | "money" | "taxpayer" | "number" }> = {
  tipo_persona:            { label: "Tipo de persona",                    type: "taxpayer" },
  renta_gravable:          { label: "Renta gravable",                     type: "money" },
  ptu_no_cobrada_anterior: { label: "PTU no cobrada del ejercicio anterior", type: "money" },
  factor_tres_meses:       { label: "Factor de 3 meses",                  type: "number" },
  dias:                    { label: "Días",                               type: "number" },
  salario:                 { label: "Salario",                            type: "money" },
  salario_diario_tope:     { label: "Salario diario tope",                type: "money" },
};

/** Versión corta de PTU_CATEGORY_LABELS para las celdas de una tabla. */
export const PTU_CATEGORY_SHORT_LABELS: Record<PtuCategory, string> = {
  N: "Normal",
  C: "Confianza",
  X: "Excluido",
};
