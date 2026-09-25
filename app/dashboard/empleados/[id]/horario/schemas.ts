import "server-only";
import { z } from "zod";

/**
 * Schema `zod` de la server action de la pestaña "Horario" de la ficha del empleado.
 * Repite en código las reglas de los CHECK de RH.empleado_horarios: valida el payload
 * del cliente antes de tocar la BD.
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeString = z.string().regex(TIME_PATTERN, "Hora inválida (HH:mm)");

const scheduleDaySchema = z
  .object({
    dia_semana:     z.number().int().min(1).max(7),
    hora_entrada_1: timeString,
    hora_salida_1:  timeString,
    hora_entrada_2: timeString.nullable(),
    hora_salida_2:  timeString.nullable(),
  })
  .superRefine((day, context) => {
    // "HH:mm" del mismo largo se compara bien como string.
    if (day.hora_salida_1 <= day.hora_entrada_1) {
      context.addIssue({
        code: "custom",
        message: "La salida del bloque 1 debe ser posterior a su entrada",
      });
    }

    const hasSecondEntry = day.hora_entrada_2 !== null;
    const hasSecondExit = day.hora_salida_2 !== null;
    if (hasSecondEntry !== hasSecondExit) {
      context.addIssue({
        code: "custom",
        message: "El bloque 2 debe llevar entrada y salida",
      });
      return;
    }
    if (day.hora_entrada_2 !== null && day.hora_salida_2 !== null) {
      if (day.hora_entrada_2 <= day.hora_salida_1) {
        context.addIssue({
          code: "custom",
          message: "El bloque 2 debe empezar después de que termina el bloque 1",
        });
      }
      if (day.hora_salida_2 <= day.hora_entrada_2) {
        context.addIssue({
          code: "custom",
          message: "La salida del bloque 2 debe ser posterior a su entrada",
        });
      }
    }
  });

export const saveEmployeeScheduleSchema = z
  .object({
    id_empleado: z.number().int().positive(),
    days:        z.array(scheduleDaySchema).max(7),
  })
  .superRefine((input, context) => {
    const weekdays = input.days.map((day) => day.dia_semana);
    if (new Set(weekdays).size !== weekdays.length) {
      context.addIssue({
        code: "custom",
        path: ["days"],
        message: "Hay días de la semana repetidos",
      });
    }
  });

export type SaveEmployeeScheduleInput = z.infer<typeof saveEmployeeScheduleSchema>;
