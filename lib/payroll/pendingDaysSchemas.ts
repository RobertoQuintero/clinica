import { z } from "zod";
import { PENDING_DAY_MOTIVE_MAX_LENGTH, PENDING_DAY_MOTIVE_MIN_LENGTH } from "@/lib/payroll/constants";

// decimal(12,2): hasta 9,999,999,999.99.
const MAX_DAILY_RATE = 9_999_999_999.99;

function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const pendingDayDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato AAAA-MM-DD")
  .refine(isRealCalendarDate, "La fecha no es válida");

function dailyRateSchema(label: string) {
  return z
    .number({ error: `${label} debe ser un número` })
    .min(0, `${label} no puede ser negativa`)
    .max(MAX_DAILY_RATE, `${label} es demasiado grande`)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, `${label} admite hasta 2 decimales`);
}

/** Motivo obligatorio de la captura: 5 a 200 caracteres útiles, igual que CK_pending_day_payments_motivo. */
export const pendingDayMotiveSchema = z
  .string()
  .trim()
  .min(PENDING_DAY_MOTIVE_MIN_LENGTH, `El motivo debe tener al menos ${PENDING_DAY_MOTIVE_MIN_LENGTH} caracteres`)
  .max(PENDING_DAY_MOTIVE_MAX_LENGTH, `El motivo no puede tener más de ${PENDING_DAY_MOTIVE_MAX_LENGTH} caracteres`);

/**
 * Captura por rango: una fila por día de [fecha_desde, fecha_hasta]. Las dos tarifas en 0 se rechazan
 * (CK_pending_day_payments_tarifas); las fechas fuera de rango o duplicadas se validan en la acción, contra la base.
 */
export const createPendingDayPaymentsSchema = z
  .object({
    id_period: z.number().int().positive("Periodo inválido"),
    id_empleado: z.number().int().positive("Empleado inválido"),
    fecha_desde: pendingDayDateSchema,
    fecha_hasta: pendingDayDateSchema,
    tarifa_operativa: dailyRateSchema("La tarifa operativa"),
    tarifa_fiscal: dailyRateSchema("La tarifa fiscal"),
    motivo: pendingDayMotiveSchema,
  })
  .refine((input) => input.fecha_desde <= input.fecha_hasta, {
    message: "La fecha inicial no puede ser posterior a la fecha final",
    path: ["fecha_hasta"],
  })
  .refine((input) => input.tarifa_operativa > 0 || input.tarifa_fiscal > 0, {
    message: "Al menos una de las dos tarifas debe ser mayor que cero",
    path: ["tarifa_fiscal"],
  });

export const deletePendingDayPaymentSchema = z.object({
  id_pending_day_payment: z.number().int().positive("Captura inválida"),
  id_period: z.number().int().positive("Periodo inválido"),
});

export type CreatePendingDayPaymentsInput = z.infer<typeof createPendingDayPaymentsSchema>;
export type DeletePendingDayPaymentInput = z.infer<typeof deletePendingDayPaymentSchema>;
