import "server-only";
import { z } from "zod";

/**
 * Schemas `zod` de las server actions de la pestaña "IMSS" (spec 91). Validan el payload del cliente
 * antes de tocar la BD; las reglas que dependen de la BD (fecha de ingreso, vigencia repetida) se
 * revalidan en SQL dentro de la transacción.
 */

const MAX_SBC = 9_999_999_999.99;

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La vigencia debe tener formato AAAA-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const calendarDate = new Date(Date.UTC(year, month - 1, day));
    return (
      calendarDate.getUTCFullYear() === year &&
      calendarDate.getUTCMonth() === month - 1 &&
      calendarDate.getUTCDate() === day
    );
  }, "La vigencia no es una fecha válida");

const sbcAmount = z
  .number({ error: "El SBC debe ser un número" })
  .positive("El SBC debe ser mayor que cero")
  .max(MAX_SBC, "El SBC es demasiado grande")
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "El SBC admite hasta 2 decimales");

const employeeIdShape = { id_empleado: z.number().int().positive("Empleado inválido") };

/** Alta de un SBC: la llave natural es (id_empleado, vigente_desde). */
export const createEmployeeSbcSchema = z.object({
  ...employeeIdShape,
  sbc: sbcAmount,
  vigente_desde: isoDateString,
});

/** Edición: solo cambia el monto. Para mover la fecha se elimina y se vuelve a crear. */
export const updateEmployeeSbcSchema = z.object({
  ...employeeIdShape,
  id_employee_sbc: z.number().int().positive("SBC inválido"),
  sbc: sbcAmount,
});

export const deleteEmployeeSbcSchema = z.object({
  ...employeeIdShape,
  id_employee_sbc: z.number().int().positive("SBC inválido"),
});

export type CreateEmployeeSbcInput = z.infer<typeof createEmployeeSbcSchema>;
export type UpdateEmployeeSbcInput = z.infer<typeof updateEmployeeSbcSchema>;
