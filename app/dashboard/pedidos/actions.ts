"use server";

import db from "@/database/connection";
import { ISuggestedProduct } from "@/interfaces/suggested_product";
import { IAuthUser } from "@/interfaces/auth";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

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

/** KPIs del encabezado de "Pedidos de inventario". */
export interface IPurchaseOrdersSummary {
  products_below_minimum: number;
  suggested_count:         number;
  last_order_date:         string | null;
  last_order_supplier:     string | null;
}

/**
 * Productos del catálogo con su existencia actual en `id_sucursal`, mínimo efectivo
 * (`COALESCE(stock.min_stock, Products.min_stock)`) y cantidad sugerida a pedir.
 * Alimenta ambas tabs de `/dashboard/pedidos/nuevo` ("Sugeridos para pedir" filtra
 * por `below_minimum`, "Todos los productos" muestra el arreglo completo).
 */
export async function getSuggestedProducts(
  id_sucursal: number
): Promise<ActionResult<ISuggestedProduct[]>> {
  try {
    const { id_empresa } = await getActiveUser();
    const rows = await db.queryParams(
      `SELECT p.[id_product],
              p.[name],
              p.[id_category],
              p.[brand],
              p.[product_code],
              p.[id_unit_measurement],
              p.[price],
              p.[id_supplier],
              p.[pieces],
              p.[split],
              p.[min_stock] AS product_min_stock,
              s.[quantity] AS stock_quantity,
              s.[min_stock] AS branch_min_stock
         FROM [CentroPodologico].[inventory].[Products] p
         LEFT JOIN [CentroPodologico].[inventory].[stock] s
                ON s.[id_product] = p.[id_product]
               AND s.[id_sucursal] = @id_sucursal
        WHERE p.[status] = 1
          AND p.[id_empresa] = @id_empresa
        ORDER BY p.[name]`,
      { id_sucursal, id_empresa }
    );

    const data: ISuggestedProduct[] = rows.map((row) => {
      const currentStock = Number(row.stock_quantity ?? 0);
      const minStockEffective =
        row.branch_min_stock !== null && row.branch_min_stock !== undefined
          ? Number(row.branch_min_stock)
          : row.product_min_stock !== null && row.product_min_stock !== undefined
          ? Number(row.product_min_stock)
          : null;
      const conversionFactor = row.split ? Number(row.pieces) || 1 : 1;
      const belowMinimum =
        minStockEffective !== null && currentStock < minStockEffective;
      const suggestedQuantity = belowMinimum
        ? Math.max(
            1,
            Math.ceil((minStockEffective! - currentStock) / conversionFactor)
          )
        : 0;

      return {
        id_product: row.id_product,
        name: row.name,
        id_category: row.id_category,
        brand: row.brand,
        product_code: row.product_code,
        id_unit_measurement: row.id_unit_measurement,
        price: Number(row.price ?? 0),
        id_supplier: row.id_supplier,
        pieces: row.pieces,
        split: Boolean(row.split),
        current_stock: currentStock,
        min_stock_effective: minStockEffective,
        suggested_quantity: suggestedQuantity,
        below_minimum: belowMinimum,
      };
    });

    return { ok: true, data };
  } catch {
    return { ok: false, message: "Error al obtener los productos sugeridos" };
  }
}

/** Datos para los tres KPIs del encabezado de "Pedidos de inventario". */
export async function getPurchaseOrdersSummary(
  id_sucursal: number
): Promise<ActionResult<IPurchaseOrdersSummary>> {
  try {
    const { id_empresa } = await getActiveUser();

    const suggestedResult = await getSuggestedProducts(id_sucursal);
    if (!suggestedResult.ok) {
      return { ok: false, message: suggestedResult.message };
    }
    const belowMinimumCount = suggestedResult.data.filter(
      (product) => product.below_minimum
    ).length;

    const lastOrderRows = await db.queryParams(
      `SELECT TOP 1
              CONVERT(varchar(10), po.[created_at], 120) AS last_order_date,
              sup.[nombre_corto] AS last_order_supplier
         FROM [CentroPodologico].[inventory].[purchase_orders] po
         JOIN [CentroPodologico].[inventory].[proveedores] sup
           ON sup.[id_proveedor] = po.[id_supplier]
        WHERE po.[id_empresa] = @id_empresa
          AND po.[id_sucursal] = @id_sucursal
          AND po.[status] = 1
        ORDER BY po.[created_at] DESC`,
      { id_empresa, id_sucursal }
    );

    const data: IPurchaseOrdersSummary = {
      products_below_minimum: belowMinimumCount,
      suggested_count: belowMinimumCount,
      last_order_date: lastOrderRows[0]?.last_order_date ?? null,
      last_order_supplier: lastOrderRows[0]?.last_order_supplier ?? null,
    };

    return { ok: true, data };
  } catch {
    return { ok: false, message: "Error al obtener el resumen de pedidos" };
  }
}
