import "server-only";
import { z } from "zod";

/**
 * Schemas `zod` de las server actions de la pestaña "Usuarios" de la ficha del empleado
 * (patrón `app/dashboard/solicitudes/schemas.ts`): validan el payload que llega del cliente
 * antes de tocar la BD.
 */

export const linkUserToEmployeeSchema = z.object({
  id_empleado: z.number().int().positive(),
  id_user:     z.number().int().positive(),
});

// Lleva id_empleado para confirmar que el usuario está vinculado a ESE empleado.
export const unlinkUserFromEmployeeSchema = linkUserToEmployeeSchema;

export type LinkUserToEmployeeInput = z.infer<typeof linkUserToEmployeeSchema>;
export type UnlinkUserFromEmployeeInput = z.infer<typeof unlinkUserFromEmployeeSchema>;
