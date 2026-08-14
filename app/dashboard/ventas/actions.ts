"use server";

import db, { ITransactionClient } from "@/database/connection";
import { applyStockMovement } from "@/lib/inventory/stock";
import { IVenta } from "@/interfaces/venta";
import { IMetodoPago } from "@/interfaces/metodo_pago";
import { IAuthUser } from "@/interfaces/auth";
import { buildDate } from "@/utils/date_helpper";
import { createWebId } from "@/utils/random";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

/** Movimientos de kardex (ver queries.txt, inventory.movements). */
const MOVEMENT_SALIDA_POR_VENTA = 6;
const MOVEMENT_ENTRADA_POR_AJUSTE = 7;
/** Categoría de `inventory.Products` vendible desde /dashboard/ventas (spec 12). */
const SALE_CATEGORY_ID = 4;

async function getActiveUser(): Promise<IAuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) throw new Error("No autenticado");
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as IAuthUser;
}

/** `id_stock_unit_measurement` del producto, para poblar el kardex del movimiento. */
async function getStockUnitMeasurement(
  tx: ITransactionClient,
  id_producto: number
): Promise<number | null> {
  const rows = await tx.queryParams(
    `SELECT [id_stock_unit_measurement]
       FROM [CentroPodologico].[inventory].[Products]
      WHERE [id_product] = @id_producto`,
    { id_producto }
  );
  return rows[0]?.id_stock_unit_measurement ?? null;
}

/** Producto vendible (categoría Venta) con precio efectivo y stock actual en la sucursal. */
export interface ISaleProduct {
  id_product:                number;
  name:                      string;
  effective_price:           number;
  id_stock_unit_measurement: number | null;
  unit_code:                 string | null;
  stock_quantity:            number;
}

/**
 * Productos de categoría "Venta" (id_category = 4), activos, de la empresa del usuario,
 * con su precio efectivo (`sale_price` si `split = 1`, si no `price`) y su stock actual
 * en `id_sucursal` (0 si no hay fila en `inventory.stock`).
 */
export async function getSaleProducts(id_sucursal: number): Promise<ISaleProduct[]> {
  const { id_empresa } = await getActiveUser();
  const rows = await db.queryParams(
    `SELECT p.[id_product],
            p.[name],
            CASE WHEN p.[split] = 1 AND p.[sale_price] IS NOT NULL
                 THEN p.[sale_price]
                 ELSE p.[price]
            END AS effective_price,
            p.[id_stock_unit_measurement],
            um.[code] AS unit_code,
            ISNULL(s.[quantity], 0) AS stock_quantity
       FROM [CentroPodologico].[inventory].[Products] p
       LEFT JOIN [CentroPodologico].[inventory].[stock] s
         ON s.[id_product] = p.[id_product] AND s.[id_sucursal] = @id_sucursal
       LEFT JOIN [CentroPodologico].[inventory].[units_measurement] um
         ON um.[id_unit_measurement] = p.[id_stock_unit_measurement]
      WHERE p.[id_category] = @id_category
        AND p.[activo] = 1
        AND p.[status] = 1
        AND p.[id_empresa] = @id_empresa
      ORDER BY p.[name]`,
    { id_sucursal, id_empresa, id_category: SALE_CATEGORY_ID }
  );
  return rows.map((row) => ({
    id_product: row.id_product,
    name: row.name,
    effective_price: Number(row.effective_price),
    id_stock_unit_measurement: row.id_stock_unit_measurement,
    unit_code: row.unit_code,
    stock_quantity: Number(row.stock_quantity),
  }));
}

export async function getVentas(
  id_sucursal: number,
  fechaInicio: string,
  fechaFin: string
): Promise<IVenta[]> {
  const data = await db.queryParams(
    `SELECT v.[id_venta],
            v.[id_producto],
            v.[id_sucursal],
            v.[cantidad],
            v.[idMetodoPago],
            v.[total],
            CONVERT(varchar(19), v.[created_at], 120) AS created_at,
            v.[id_usuario],
            v.[status],
            v.[webid],
            v.[facturado],
            v.[uuid_cfdi],
            p.[name] AS nombre_producto,
            mp.[descripcion] AS descripcion_metodo
       FROM [CentroPodologico].[dbo].[Ventas] v
  LEFT JOIN [CentroPodologico].[inventory].[Products] p
         ON p.[id_product] = v.[id_producto]
  LEFT JOIN [CentroPodologico].[dbo].[MetodosPagos] mp
         ON mp.[idMetodoPago] = v.[idMetodoPago]
      WHERE v.[status] = 1
        AND v.[id_sucursal] = @id_sucursal
        AND CAST(v.[created_at] AS DATE) >= CAST(@fechaInicio AS DATE)
        AND CAST(v.[created_at] AS DATE) <= CAST(@fechaFin AS DATE)
      ORDER BY v.[created_at] DESC`,
    { id_sucursal, fechaInicio, fechaFin }
  );
  return data as IVenta[];
}

export async function getMetodosPagos(): Promise<IMetodoPago[]> {
  const data = await db.query(
    `SELECT [idMetodoPago], [descripcion], [clave], [eliminado], [activo]
       FROM [CentroPodologico].[dbo].[MetodosPagos]
      WHERE [activo] = 1 AND [eliminado] = 0`
  );
  return data as IMetodoPago[];
}

export type VentaForm = {
  id_venta:     number;
  id_producto:  number;
  id_sucursal:  number;
  cantidad:     number;
  idMetodoPago: number;
  total:        number;
};

/**
 * Crea o actualiza una venta, reflejando el movimiento de stock correspondiente
 * dentro de la misma transacción (ver spec 16, "Modelo de datos"). `id_empresa`
 * e `id_user` se toman del JWT; `id_sucursal` viaja explícito desde `SucursalContext`.
 */
export async function saveVenta(
  form: VentaForm
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { id_venta, id_producto, id_sucursal, cantidad, idMetodoPago, total } = form;
    const { id_empresa, id_user } = await getActiveUser();

    await db.transaction(async (tx) => {
      if (id_venta === 0) {
        const nextIdRows = await tx.queryParams(
          `SELECT ISNULL(MAX([id_venta]), 0) + 1 AS next_id
             FROM [CentroPodologico].[dbo].[Ventas]`,
          {}
        );
        const newIdVenta = Number(nextIdRows[0].next_id);
        const idStockUnitMeasurement = await getStockUnitMeasurement(tx, id_producto);

        await tx.queryParams(
          `INSERT INTO [CentroPodologico].[dbo].[Ventas]
             ([id_venta], [id_producto], [id_sucursal], [cantidad], [idMetodoPago], [total],
              [created_at], [id_usuario], [status], [webid], [facturado], [uuid_cfdi])
           VALUES (
             @id_venta,
             @id_producto, @id_sucursal, @cantidad, @idMetodoPago, @total,
             @created_at, @id_usuario, 1, CONVERT(varchar,@id_venta)+'-'+@webid, 0, NULL
           )`,
          {
            id_venta: newIdVenta,
            id_producto,
            id_sucursal,
            cantidad,
            idMetodoPago,
            total,
            created_at: buildDate(new Date()),
            id_usuario: id_user,
            webid: createWebId(9),
          }
        );

        await applyStockMovement(tx, {
          id_product: id_producto,
          id_sucursal,
          id_empresa,
          id_movement: MOVEMENT_SALIDA_POR_VENTA,
          quantity: cantidad,
          id_unit_measurement: idStockUnitMeasurement,
          id_venta: newIdVenta,
          id_user,
        });
      } else {
        const currentRows = await tx.queryParams(
          `SELECT [id_producto], [id_sucursal], [cantidad]
             FROM [CentroPodologico].[dbo].[Ventas] WITH (UPDLOCK, HOLDLOCK)
            WHERE [id_venta] = @id_venta`,
          { id_venta }
        );
        if (currentRows.length === 0) {
          throw new Error("La venta no existe");
        }
        const current = currentRows[0];
        const oldProducto = Number(current.id_producto);
        const oldSucursal = Number(current.id_sucursal);
        const oldCantidad = Number(current.cantidad);

        if (oldProducto === id_producto) {
          const delta = cantidad - oldCantidad;
          if (delta !== 0) {
            const idStockUnitMeasurement = await getStockUnitMeasurement(tx, id_producto);
            await applyStockMovement(tx, {
              id_product: id_producto,
              id_sucursal: oldSucursal,
              id_empresa,
              id_movement: delta > 0 ? MOVEMENT_SALIDA_POR_VENTA : MOVEMENT_ENTRADA_POR_AJUSTE,
              quantity: Math.abs(delta),
              id_unit_measurement: idStockUnitMeasurement,
              id_venta,
              notes: delta < 0 ? `Reversión por edición de venta #${id_venta}` : null,
              id_user,
            });
          }
        } else {
          const oldUnitMeasurement = await getStockUnitMeasurement(tx, oldProducto);
          await applyStockMovement(tx, {
            id_product: oldProducto,
            id_sucursal: oldSucursal,
            id_empresa,
            id_movement: MOVEMENT_ENTRADA_POR_AJUSTE,
            quantity: oldCantidad,
            id_unit_measurement: oldUnitMeasurement,
            id_venta,
            notes: `Reversión por edición de venta #${id_venta}`,
            id_user,
          });

          const newUnitMeasurement = await getStockUnitMeasurement(tx, id_producto);
          await applyStockMovement(tx, {
            id_product: id_producto,
            id_sucursal: oldSucursal,
            id_empresa,
            id_movement: MOVEMENT_SALIDA_POR_VENTA,
            quantity: cantidad,
            id_unit_measurement: newUnitMeasurement,
            id_venta,
            id_user,
          });
        }

        await tx.queryParams(
          `UPDATE [CentroPodologico].[dbo].[Ventas]
              SET [id_producto]  = @id_producto,
                  [cantidad]     = @cantidad,
                  [idMetodoPago] = @idMetodoPago,
                  [total]        = @total
            WHERE [id_venta] = @id_venta`,
          { id_venta, id_producto, cantidad, idMetodoPago, total }
        );
      }
    });

    revalidatePath("/dashboard/ventas");
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al guardar la venta" };
  }
}

/**
 * Elimina (soft-delete) una venta, revirtiendo por completo el stock que había
 * descontado antes de marcar `status = 0` (ver spec 16, "Modelo de datos").
 */
export async function deleteVenta(
  id_venta: number
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { id_empresa, id_user } = await getActiveUser();

    await db.transaction(async (tx) => {
      const rows = await tx.queryParams(
        `SELECT [id_producto], [id_sucursal], [cantidad]
           FROM [CentroPodologico].[dbo].[Ventas] WITH (UPDLOCK, HOLDLOCK)
          WHERE [id_venta] = @id_venta`,
        { id_venta }
      );
      if (rows.length === 0) {
        throw new Error("La venta no existe");
      }
      const row = rows[0];
      const id_producto = Number(row.id_producto);
      const id_sucursal = Number(row.id_sucursal);
      const cantidad = Number(row.cantidad);

      const idStockUnitMeasurement = await getStockUnitMeasurement(tx, id_producto);

      await applyStockMovement(tx, {
        id_product: id_producto,
        id_sucursal,
        id_empresa,
        id_movement: MOVEMENT_ENTRADA_POR_AJUSTE,
        quantity: cantidad,
        id_unit_measurement: idStockUnitMeasurement,
        id_venta,
        notes: `Reversión por eliminación de venta #${id_venta}`,
        id_user,
      });

      await tx.queryParams(
        `UPDATE [CentroPodologico].[dbo].[Ventas] SET [status] = 0 WHERE [id_venta] = @id_venta`,
        { id_venta }
      );
    });

    revalidatePath("/dashboard/ventas");
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al eliminar la venta" };
  }
}
