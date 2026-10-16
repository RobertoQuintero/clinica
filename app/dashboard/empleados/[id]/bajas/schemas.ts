import "server-only";
import { z } from "zod";
import { isoDateString } from "@/app/dashboard/empleados/[id]/vacaciones/schemas";
import { TERMINATION_NOTES_MAX_LENGTH } from "@/lib/terminations/terminationRules";

/**
 * Schemas `zod` de las server actions de bajas (spec 86). Validan el payload que llega del
 * cliente antes de tocar la BD.
 */

const terminationType = z.enum(["R", "D"], { message: "Tipo de baja inválido" });

/** Cadena vacía o solo espacios se guarda como `null`. */
const optionalNotes = z
  .string()
  .trim()
  .max(
    TERMINATION_NOTES_MAX_LENGTH,
    `Las observaciones no pueden pasar de ${TERMINATION_NOTES_MAX_LENGTH} caracteres`
  )
  .optional()
  .transform((value) => (value ? value : null));

export const registerEmployeeTerminationSchema = z.object({
  id_empleado:      z.number().int().positive(),
  fecha_baja:       isoDateString,
  clave_causa:      z.string().regex(/^[1-9A]$/, "Causa de baja inválida"),
  tipo_terminacion: terminationType,
  observaciones:    optionalNotes,
});

export type RegisterEmployeeTerminationInput = z.infer<typeof registerEmployeeTerminationSchema>;
