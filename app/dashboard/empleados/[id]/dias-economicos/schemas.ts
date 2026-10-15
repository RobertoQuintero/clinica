import "server-only";
import { z } from "zod";
import { isoDateString } from "@/app/dashboard/empleados/[id]/vacaciones/schemas";

/**
 * Schemas `zod` de las server actions de la pestaña "Días económicos" (spec 79). Validan el payload
 * que llega del cliente antes de tocar la BD.
 */

const requiredReason = z
  .string()
  .trim()
  .min(1, "El motivo es obligatorio")
  .max(500, "El motivo no puede pasar de 500 caracteres");

export const registerEconomicDaySchema = z.object({
  id_empleado: z.number().int().positive(),
  fecha:       isoDateString,
  motivo:      requiredReason,
});

export type RegisterEconomicDayInput = z.infer<typeof registerEconomicDaySchema>;
