import "server-only";
import { z } from "zod";

/**
 * Schemas `zod` de las server actions de la pestaña "Vacaciones" (spec 76). Validan el payload
 * que llega del cliente antes de tocar la BD. `fecha_fin` no se acepta: la calcula el servidor.
 */

export const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const calendarDate = new Date(Date.UTC(year, month - 1, day));
    return (
      calendarDate.getUTCFullYear() === year &&
      calendarDate.getUTCMonth() === month - 1 &&
      calendarDate.getUTCDate() === day
    );
  }, "Fecha inválida");

export const scheduleVacationBlockSchema = z.object({
  id_empleado:             z.number().int().positive(),
  id_vacation_entitlement: z.number().int().positive(),
  fecha_inicio:            isoDateString,
  dias_tomados:            z.number().int().min(1, "Captura al menos 1 día"),
});

export type ScheduleVacationBlockInput = z.infer<typeof scheduleVacationBlockSchema>;

const requiredReason = z
  .string()
  .trim()
  .min(1, "El motivo es obligatorio")
  .max(500, "El motivo no puede pasar de 500 caracteres");

export const rescheduleVacationBlockSchema = scheduleVacationBlockSchema.extend({
  motivo: requiredReason,
});

export const payrollPeriodForDateSchema = z.object({
  id_empleado: z.number().int().positive(),
  fecha:       isoDateString,
});

export const cancelVacationBlockSchema = z.object({
  id_empleado:             z.number().int().positive(),
  id_vacation_entitlement: z.number().int().positive(),
  motivo:                  requiredReason,
});

export const markVacationDaysPaidSchema = z.object({
  id_empleado:             z.number().int().positive(),
  id_vacation_entitlement: z.number().int().positive(),
  fecha_pago:              isoDateString,
  comentario:              z
    .string()
    .trim()
    .max(500, "El comentario no puede pasar de 500 caracteres")
    .optional(),
});

// Mismo payload que la cancelación: el pago se revierte con motivo obligatorio.
export const revertVacationPaymentSchema = cancelVacationBlockSchema;

export type MarkVacationDaysPaidInput = z.infer<typeof markVacationDaysPaidSchema>;
export type RevertVacationPaymentInput = z.infer<typeof revertVacationPaymentSchema>;
export type RescheduleVacationBlockInput = z.infer<typeof rescheduleVacationBlockSchema>;
export type CancelVacationBlockInput = z.infer<typeof cancelVacationBlockSchema>;
