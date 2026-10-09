import type { TaxParameterKey } from "@/interfaces/payroll_tax_parameters";

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

// Parámetros fiscales anuales (spec 69). Las 9 claves de payroll.tax_parameters, con etiqueta y unidad para la pantalla.
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
};
export const TAX_PARAMETERS_LOG_PAGE_SIZE = 20;
