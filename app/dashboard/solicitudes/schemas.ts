import "server-only";
import { z } from "zod";

/**
 * Schemas `zod` de las server actions de `solicitudes` (patrón `lib/billing/schemas.ts`):
 * el rol 2 no debe poder colar precio/proveedor en el payload, y estas validaciones
 * son la frontera real, no solo el tipo TS que el bundler borra en runtime.
 */

const requestLineSchema = z.object({
  id_product: z.number().int().positive(),
  quantity:   z.number().positive(),
});

export const createPurchaseRequestSchema = z.object({
  id_sucursal: z.number().int().positive(),
  notes:       z.string().max(1000).nullable().optional(),
  lines:       z.array(requestLineSchema).min(1),
});

export const updatePurchaseRequestSchema = createPurchaseRequestSchema
  .omit({ id_sucursal: true })
  .extend({ id_purchase_request: z.number().int().positive() });

export const rejectPurchaseRequestSchema = z.object({
  id_purchase_request: z.number().int().positive(),
  rejection_reason:    z.string().trim().min(1).max(500), // motivo obligatorio
});

export type CreatePurchaseRequestInput = z.infer<typeof createPurchaseRequestSchema>;
export type UpdatePurchaseRequestInput = z.infer<typeof updatePurchaseRequestSchema>;
export type RejectPurchaseRequestInput = z.infer<typeof rejectPurchaseRequestSchema>;
