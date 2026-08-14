import db from "@/database/connection";
import { applyStockMovement } from "@/lib/inventory/stock";

/** Movimiento 5 "Salida por consulta" (SXC), sembrado en inventory.movements. */
const MOVEMENT_SALIDA_POR_CONSULTA = 5;

export interface IApplyConsultationConsumptionInput {
  id_consulta: number;
  id_sucursal: number;
  id_empresa: number;
  id_user: number;
}

/**
 * Descuenta del stock de la sucursal todos los insumos marcados como consumo
 * automático (`auto_consume = 1`) al crearse una consulta, registrando cada
 * descuento en `inventory.kardex` bajo el movimiento 5 "Salida por consulta"
 * (ver spec 13).
 *
 * Best-effort: nunca lanza hacia afuera. Si falla, el error se registra en
 * `console.error` y la función retorna sin propagar, para no bloquear ni
 * revertir la creación de la consulta que ya ocurrió.
 */
export async function applyConsultationConsumption(
  input: IApplyConsultationConsumptionInput
): Promise<void> {
  const { id_consulta, id_sucursal, id_empresa, id_user } = input;

  try {
    const products = await db.queryParams(
      `SELECT [id_product], [consumption_per_consultation], [id_stock_unit_measurement]
         FROM [CentroPodologico].[inventory].[Products]
        WHERE [auto_consume] = 1
          AND [consumption_per_consultation] > 0
          AND [id_empresa] = @id_empresa
          AND [activo] = 1
          AND [status] = 1`,
      { id_empresa }
    );

    if (products.length === 0) return;

    await db.transaction(async (tx) => {
      for (const product of products) {
        await applyStockMovement(tx, {
          id_product: product.id_product,
          id_sucursal,
          id_empresa,
          id_movement: MOVEMENT_SALIDA_POR_CONSULTA,
          quantity: Number(product.consumption_per_consultation),
          id_unit_measurement: product.id_stock_unit_measurement ?? null,
          unit_cost: null,
          id_purchase_order_item: null,
          id_reception: null,
          id_consulta,
          notes: null,
          id_user,
        });
      }
    });
  } catch (error) {
    console.error(
      `[applyConsultationConsumption] Error al descontar insumos de la consulta ${id_consulta}:`,
      error
    );
  }
}
