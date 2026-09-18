import { z } from "zod";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function periodDate(label: string) {
  return z
    .string()
    .regex(DATE_REGEX, `${label} debe tener formato AAAA-MM-DD`)
    .refine(isRealCalendarDate, `${label} no es una fecha válida`);
}

const periodDatesShape = {
  fecha_inicio: periodDate("La fecha de inicio"),
  fecha_fin: periodDate("La fecha de fin"),
  fecha_corte: periodDate("La fecha de corte"),
  fecha_pago: periodDate("La fecha de pago"),
};

type PeriodDatesInput = { fecha_inicio: string; fecha_fin: string; fecha_corte: string; fecha_pago: string };

// Fechas "YYYY-MM-DD": la comparación de strings equivale a la cronológica.
function validatePeriodDateOrder(dates: PeriodDatesInput, context: z.RefinementCtx) {
  if (dates.fecha_fin < dates.fecha_inicio) {
    context.addIssue({ code: "custom", path: ["fecha_fin"], message: "La fecha de fin no puede ser anterior a la de inicio" });
  }
  if (dates.fecha_corte < dates.fecha_inicio || dates.fecha_corte > dates.fecha_fin) {
    context.addIssue({ code: "custom", path: ["fecha_corte"], message: "La fecha de corte debe estar dentro del periodo (entre inicio y fin)" });
  }
  if (dates.fecha_pago < dates.fecha_corte) {
    context.addIssue({ code: "custom", path: ["fecha_pago"], message: "La fecha de pago no puede ser anterior a la de corte" });
  }
}

export const createPayrollPeriodSchema = z
  .object({
    id_payment_period: z.number().int().positive("Selecciona una frecuencia"),
    ...periodDatesShape,
  })
  .superRefine(validatePeriodDateOrder);

export const updatePayrollPeriodSchema = z
  .object({
    id_period: z.number().int().positive(),
    ...periodDatesShape,
  })
  .superRefine(validatePeriodDateOrder);

export type CreatePayrollPeriodInput = z.infer<typeof createPayrollPeriodSchema>;
export type UpdatePayrollPeriodInput = z.infer<typeof updatePayrollPeriodSchema>;
