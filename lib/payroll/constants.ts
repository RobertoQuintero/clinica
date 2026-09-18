export const PAYROLL_PERIOD_STATUS = {
  1: { label: "Programada",  badge: "neutral" },
  2: { label: "En cálculo",  badge: "info" },
  3: { label: "Aprobada",    badge: "warning" },
  4: { label: "Pagada",      badge: "success" },
} as const;

// clave_sat -> letra del código. Las frecuencias fuera de este mapa no se ofrecen.
export const PAYROLL_FREQUENCY_LETTER_BY_SAT_KEY: Record<string, string> = {
  "01": "D", "02": "S", "03": "C", "04": "Q", "05": "M", "06": "B", "10": "X",
};

export const PAYROLL_PERIODS_PAGE_SIZE = 20;
export const PAYROLL_ALLOWED_ROLE_IDS = [1, 4];
