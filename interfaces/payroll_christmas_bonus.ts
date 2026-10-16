export type Article174SkipReason =
  | "no_monthly_withholding_table"
  | "income_in_gap"
  | "exemption_not_calculated";

/** Desglose congelado del ISR art. 174 RLISR (`payroll.period_employee_isr_article174`). */
export interface IArticle174IsrBreakdown {
  isr_estado: "C" | "N";
  isr_motivo: Article174SkipReason | null;
  base_gravable: number | null;
  ingreso_ordinario_mensual: number | null;
  parte_mensualizada: number | null;
  ejercicio_tarifa: number | null;
  limite_inferior_ordinario: number | null;
  cuota_fija_ordinario: number | null;
  porcentaje_ordinario: number | null;
  isr_ordinario: number | null;
  limite_inferior_total: number | null;
  cuota_fija_total: number | null;
  porcentaje_total: number | null;
  isr_total: number | null;
  diferencia_isr: number | null;
  tasa: number | null;
  isr_retenido: number | null;
}

export type ChristmasBonusDeadlineState = "none" | "upcoming" | "overdue";
