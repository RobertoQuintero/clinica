"use server";

import db from "@/database/connection";
import { applyStockMovement } from "@/lib/inventory/stock";
import { IAuthUser } from "@/interfaces/auth";
import { IReceptionLineInput } from "@/interfaces/purchase_reception";
import { buildDate, addZeroToday } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

/** Movimiento de kardex para entradas por compra (ver queries.txt, inventory.movements). */
const MOVEMENT_ENTRADA_POR_COMPRA = 1;

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

async function getActiveUser(): Promise<IAuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) throw new Error("No autenticado");
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as IAuthUser;
}

/** Fila del listado de recepciones pendientes, con el avance de líneas completas. */
export interface IPendingReception {
  id_purchase_order: number;
  folio:              string;
  supplier_name:      string;
  id_status:          number;
  total:              number;
  estimated_date:     string | null;
  created_at:         string;
  lines_total:        number;
  lines_completed:    number;
}

/** Órdenes en `Enviado`/`Parcial` en la sucursal, listas para capturar su recepción. */
export async function getPendingReceptions(
  id_sucursal: number
): Promise<ActionResult<IPendingReception[]>> {
  try {
    const { id_empresa } = await getActiveUser();
    const rows = await db.queryParams(
      `SELECT po.[id_purchase_order],
              po.[folio],
              sup.[nombre_corto] AS supplier_name,
              po.[id_status],
              po.[total],
              CONVERT(varchar(10), po.[estimated_date], 120) AS estimated_date,
              CONVERT(varchar(19), po.[created_at], 120) AS created_at,
              COUNT(poi.[id_purchase_order_item]) AS lines_total,
              SUM(CASE WHEN poi.[quantity_received] >= poi.[quantity] THEN 1 ELSE 0 END) AS lines_completed
         FROM [CentroPodologico].[inventory].[purchase_orders] po
         JOIN [CentroPodologico].[inventory].[proveedores] sup
           ON sup.[id_proveedor] = po.[id_supplier]
         JOIN [CentroPodologico].[inventory].[purchase_order_items] poi
           ON poi.[id_purchase_order] = po.[id_purchase_order]
        WHERE po.[id_empresa] = @id_empresa
          AND po.[id_sucursal] = @id_sucursal
          AND po.[status] = 1
          AND po.[id_status] IN (2, 4)
        GROUP BY po.[id_purchase_order], po.[folio], sup.[nombre_corto], po.[id_status],
                 po.[total], po.[estimated_date], po.[created_at]
        ORDER BY po.[created_at] DESC`,
      { id_empresa, id_sucursal }
    );
    return { ok: true, data: rows as IPendingReception[] };
  } catch {
    return { ok: false, message: "Error al obtener las recepciones pendientes" };
  }
}

export interface IReceptionLineDetail {
  id_purchase_order_item: number;
  id_product:              number;
  product_name:            string;
  product_code:            string;
  id_unit_measurement:    number | null;
  quantity:                number;
  quantity_received:      number;
  quantity_pending:        number;
  unit_price:              number;
}

export interface IReceptionDetail {
  id_purchase_order: number;
  folio:              string;
  supplier_name:      string;
  id_status:          number;
  id_sucursal:        number;
  items:              IReceptionLineDetail[];
}

/** Detalle para capturar la recepción: por línea, lo pedido, lo ya recibido y lo pendiente. */
export async function getReceptionDetail(
  id_purchase_order: number
): Promise<ActionResult<IReceptionDetail>> {
  try {
    const { id_empresa } = await getActiveUser();

    const headerRows = await db.queryParams(
      `SELECT po.[id_purchase_order],
              po.[folio],
              po.[id_status],
              po.[id_sucursal],
              sup.[nombre_corto] AS supplier_name
         FROM [CentroPodologico].[inventory].[purchase_orders] po
         JOIN [CentroPodologico].[inventory].[proveedores] sup
           ON sup.[id_proveedor] = po.[id_supplier]
        WHERE po.[id_purchase_order] = @id_purchase_order
          AND po.[id_empresa] = @id_empresa`,
      { id_purchase_order, id_empresa }
    );

    if (headerRows.length === 0) {
      return { ok: false, message: "La orden de compra no existe" };
    }
    const header = headerRows[0];
    if (header.id_status !== 2 && header.id_status !== 4) {
      return {
        ok: false,
        message: "Solo se pueden recibir órdenes en estado Enviado o Parcial",
      };
    }

    const itemRows = await db.queryParams(
      `SELECT [id_purchase_order_item],
              [id_product],
              [product_name],
              [product_code],
              [id_unit_measurement],
              [quantity],
              [quantity_received],
              [unit_price]
         FROM [CentroPodologico].[inventory].[purchase_order_items]
        WHERE [id_purchase_order] = @id_purchase_order
        ORDER BY [id_purchase_order_item]`,
      { id_purchase_order }
    );

    const items: IReceptionLineDetail[] = itemRows.map((row) => ({
      id_purchase_order_item: row.id_purchase_order_item,
      id_product: row.id_product,
      product_name: row.product_name,
      product_code: row.product_code,
      id_unit_measurement: row.id_unit_measurement,
      quantity: Number(row.quantity),
      quantity_received: Number(row.quantity_received),
      quantity_pending: Number(row.quantity) - Number(row.quantity_received),
      unit_price: Number(row.unit_price),
    }));

    const data: IReceptionDetail = {
      id_purchase_order: header.id_purchase_order,
      folio: header.folio,
      supplier_name: header.supplier_name,
      id_status: header.id_status,
      id_sucursal: header.id_sucursal,
      items,
    };

    return { ok: true, data };
  } catch {
    return { ok: false, message: "Error al obtener el detalle de la recepción" };
  }
}

/**
 * Confirma una recepción: revalida el estado de la orden y las cantidades pendientes
 * contra la BD (nunca contra lo que envía el cliente), inserta la recepción, aplica
 * el movimiento de kardex `EXC` por cada línea con cantidad > 0 y recalcula el estado
 * de la orden. Todo en una sola transacción — idempotente ante doble envío porque
 * un segundo intento con la misma cantidad ya no cabe en el pendiente recalculado.
 */
export async function confirmReception(
  id_purchase_order: number,
  lines: IReceptionLineInput[],
  notes: string | null
): Promise<ActionResult<{ id_status: number; is_final: boolean }>> {
  try {
    const { id_empresa, id_user } = await getActiveUser();

    const linesToReceive = lines.filter((line) => line.quantity_received_now > 0);
    if (linesToReceive.length === 0) {
      return { ok: false, message: "Captura al menos una cantidad recibida mayor a cero" };
    }
    if (lines.some((line) => line.quantity_received_now < 0)) {
      return { ok: false, message: "La cantidad recibida no puede ser negativa" };
    }

    const result = await db.transaction(async (tx) => {
      // Bloquea el encabezado para serializar recepciones concurrentes de la misma orden.
      const orderRows = await tx.queryParams(
        `SELECT [id_purchase_order], [id_status], [id_sucursal]
           FROM [CentroPodologico].[inventory].[purchase_orders] WITH (UPDLOCK, HOLDLOCK)
          WHERE [id_purchase_order] = @id_purchase_order
            AND [id_empresa] = @id_empresa`,
        { id_purchase_order, id_empresa }
      );
      if (orderRows.length === 0) {
        throw new Error("La orden de compra no existe");
      }
      const order = orderRows[0];
      if (order.id_status !== 2 && order.id_status !== 4) {
        throw new Error("La orden no está en estado Enviado o Parcial: no se puede recibir");
      }

      const now = buildDate(new Date());

      const receptionResult = await tx.queryParams(
        `INSERT INTO [CentroPodologico].[inventory].[purchase_receptions]
           ([id_purchase_order],[id_sucursal],[id_user],[notes],[is_final],[created_at])
         OUTPUT inserted.id_reception
         VALUES (@id_purchase_order,@id_sucursal,@id_user,@notes,0,@created_at)`,
        {
          id_purchase_order,
          id_sucursal: order.id_sucursal,
          id_user,
          notes: notes || null,
          created_at: now,
        }
      );
      const id_reception = receptionResult[0].id_reception;

      for (const line of linesToReceive) {
        const itemRows = await tx.queryParams(
          `SELECT poi.[id_purchase_order_item],
                  poi.[id_product],
                  poi.[product_name],
                  poi.[quantity],
                  poi.[quantity_received],
                  poi.[conversion_factor],
                  poi.[unit_price],
                  p.[id_stock_unit_measurement]
             FROM [CentroPodologico].[inventory].[purchase_order_items] poi WITH (UPDLOCK, HOLDLOCK)
             LEFT JOIN [CentroPodologico].[inventory].[Products] p
                    ON p.[id_product] = poi.[id_product]
            WHERE poi.[id_purchase_order_item] = @id_purchase_order_item
              AND poi.[id_purchase_order] = @id_purchase_order`,
          { id_purchase_order_item: line.id_purchase_order_item, id_purchase_order }
        );
        if (itemRows.length === 0) {
          throw new Error(`La línea ${line.id_purchase_order_item} no pertenece a esta orden`);
        }
        const item = itemRows[0];
        const pending = Number(item.quantity) - Number(item.quantity_received);
        if (line.quantity_received_now > pending) {
          throw new Error(
            `No puedes recibir más de lo pendiente (${pending}) para "${item.product_name}"`
          );
        }

        await tx.queryParams(
          `UPDATE [CentroPodologico].[inventory].[purchase_order_items]
              SET [quantity_received] = [quantity_received] + @quantity_received_now
            WHERE [id_purchase_order_item] = @id_purchase_order_item`,
          {
            id_purchase_order_item: line.id_purchase_order_item,
            quantity_received_now: line.quantity_received_now,
          }
        );

        const conversionFactor = Number(item.conversion_factor) || 1;
        await applyStockMovement(tx, {
          id_product: item.id_product,
          id_sucursal: order.id_sucursal,
          id_empresa,
          id_movement: MOVEMENT_ENTRADA_POR_COMPRA,
          quantity: line.quantity_received_now * conversionFactor,
          id_unit_measurement: item.id_stock_unit_measurement ?? null,
          unit_cost: item.unit_price,
          id_purchase_order_item: item.id_purchase_order_item,
          id_reception,
          notes: notes || null,
          id_user,
        });
      }

      // Recalcula el estado de la orden con los acumulados ya actualizados.
      const remainingRows = await tx.queryParams(
        `SELECT COUNT(*) AS pending_lines
           FROM [CentroPodologico].[inventory].[purchase_order_items]
          WHERE [id_purchase_order] = @id_purchase_order
            AND [quantity_received] < [quantity]`,
        { id_purchase_order }
      );
      const isFinal = Number(remainingRows[0]?.pending_lines ?? 0) === 0;
      const newStatus = isFinal ? 3 : 4; // 3 = Stock, 4 = Parcial

      if (isFinal) {
        const today = addZeroToday(new Date());
        await tx.queryParams(
          `UPDATE [CentroPodologico].[inventory].[purchase_orders]
              SET [id_status] = @id_status,
                  [closed_at] = @closed_at,
                  [delivery_date] = @delivery_date
            WHERE [id_purchase_order] = @id_purchase_order`,
          { id_purchase_order, id_status: newStatus, closed_at: now, delivery_date: today }
        );
      } else {
        await tx.queryParams(
          `UPDATE [CentroPodologico].[inventory].[purchase_orders]
              SET [id_status] = @id_status
            WHERE [id_purchase_order] = @id_purchase_order`,
          { id_purchase_order, id_status: newStatus }
        );
      }

      await tx.queryParams(
        `UPDATE [CentroPodologico].[inventory].[purchase_receptions]
            SET [is_final] = @is_final
          WHERE [id_reception] = @id_reception`,
        { id_reception, is_final: isFinal }
      );

      return { id_status: newStatus, is_final: isFinal };
    });

    revalidatePath("/dashboard/recepciones");
    revalidatePath(`/dashboard/recepciones/${id_purchase_order}`);
    revalidatePath(`/dashboard/pedidos/${id_purchase_order}`);
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al confirmar la recepción",
    };
  }
}
