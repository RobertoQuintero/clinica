import { ITransactionClient } from "@/database/connection";
import { buildDate } from "@/utils/date_helpper";

export interface IApplyStockMovementInput {
  id_product:              number;
  id_sucursal:             number;
  id_empresa:              number;
  id_movement:             number;
  /** Siempre positiva, en unidades de stock; el signo lo aporta increases_storage del movimiento. */
  quantity:                number;
  id_unit_measurement?:    number | null;
  unit_cost?:              number | null;
  id_purchase_order_item?: number | null;
  id_reception?:           number | null;
  id_consulta?:            number | null;
  notes?:                  string | null;
  id_user:                 number;
}

/**
 * Aplica un movimiento de inventario dentro de una transacción: actualiza (o crea)
 * el snapshot de `inventory.stock` y anexa la fila correspondiente a `inventory.kardex`.
 * Reutilizable por cualquier flujo que mueva stock (compras, ventas, traspasos, ajustes).
 *
 * Devuelve el acumulado (`balance_after`) tras aplicar el movimiento.
 */
export async function applyStockMovement(
  tx: ITransactionClient,
  input: IApplyStockMovementInput
): Promise<number> {
  const {
    id_product,
    id_sucursal,
    id_empresa,
    id_movement,
    quantity,
    id_unit_measurement = null,
    unit_cost = null,
    id_purchase_order_item = null,
    id_reception = null,
    id_consulta = null,
    notes = null,
    id_user,
  } = input;

  const movementRows = await tx.queryParams(
    `SELECT [increases_storage]
       FROM [CentroPodologico].[inventory].[movements]
      WHERE [id_movement] = @id_movement`,
    { id_movement }
  );
  if (movementRows.length === 0) {
    throw new Error(`Movimiento de inventario inválido: ${id_movement}`);
  }
  const increasesStorage = Boolean(movementRows[0].increases_storage);
  const delta = increasesStorage ? quantity : -quantity;
  const now = buildDate(new Date());

  // UPDLOCK + HOLDLOCK: si dos recepciones concurrentes tocan el mismo producto+sucursal,
  // la segunda espera a que la primera libere el bloqueo, evitando una condición de carrera
  // sobre el acumulado. El acumulado se toma del OUTPUT, nunca de un SELECT previo.
  const updateResult = await tx.queryParams(
    `UPDATE [CentroPodologico].[inventory].[stock] WITH (UPDLOCK, HOLDLOCK)
        SET [quantity]   = [quantity] + @delta,
            [updated_at] = @now
      OUTPUT inserted.quantity
      WHERE [id_product] = @id_product
        AND [id_sucursal] = @id_sucursal`,
    { delta, now, id_product, id_sucursal }
  );

  let balanceAfter: number;
  if (updateResult.length > 0) {
    balanceAfter = Number(updateResult[0].quantity);
  } else {
    const insertResult = await tx.queryParams(
      `INSERT INTO [CentroPodologico].[inventory].[stock] ([id_product],[id_sucursal],[quantity],[updated_at])
       OUTPUT inserted.quantity
       VALUES (@id_product, @id_sucursal, @delta, @now)`,
      { id_product, id_sucursal, delta, now }
    );
    balanceAfter = Number(insertResult[0].quantity);
  }

  await tx.queryParams(
    `INSERT INTO [CentroPodologico].[inventory].[kardex]
       ([id_product],[id_sucursal],[id_empresa],[id_movement],[quantity],[balance_after],
        [id_unit_measurement],[unit_cost],[id_purchase_order_item],[id_reception],[id_consulta],[notes],[id_user],[created_at])
     VALUES
       (@id_product, @id_sucursal, @id_empresa, @id_movement, @quantity, @balance_after,
        @id_unit_measurement, @unit_cost, @id_purchase_order_item, @id_reception, @id_consulta, @notes, @id_user, @created_at)`,
    {
      id_product,
      id_sucursal,
      id_empresa,
      id_movement,
      quantity,
      balance_after: balanceAfter,
      id_unit_measurement,
      unit_cost,
      id_purchase_order_item,
      id_reception,
      id_consulta,
      notes,
      id_user,
      created_at: now,
    }
  );

  return balanceAfter;
}
