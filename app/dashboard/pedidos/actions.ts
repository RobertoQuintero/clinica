"use server";

import { randomUUID } from "crypto";
import db from "@/database/connection";
import { ISuggestedProduct } from "@/interfaces/suggested_product";
import { IAuthUser } from "@/interfaces/auth";
import { IPurchaseOrder, IPurchaseOrderItem } from "@/interfaces/purchase_order";
import { IPurchaseReception } from "@/interfaces/purchase_reception";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
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

export interface ICreatePurchaseOrderLineInput {
  id_product:  number;
  id_supplier: number | null;
  quantity:    number;
  unit_price:  number;
}

export interface ICreatePurchaseOrdersInput {
  id_sucursal:    number;
  estimated_date: string | null;
  notes:          string;
  lines:          ICreatePurchaseOrderLineInput[];
}

const TAX_RATE = 16;

/** Redondea a 2 decimales evitando el error de coma flotante de un simple `Math.round(x*100)/100`. */
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Crea una orden de compra por proveedor a partir del carrito revisado, todas
 * agrupadas bajo un mismo `id_batch`. Una sola transacción: valida los productos
 * contra la BD, recalcula subtotal/IVA/total en el servidor (nunca confía en lo
 * enviado por el cliente) y congela `conversion_factor` en cada línea.
 */
export async function createPurchaseOrders(
  input: ICreatePurchaseOrdersInput
): Promise<ActionResult<{ folios: string[] }>> {
  try {
    const { id_empresa, id_user } = await getActiveUser();
    const { id_sucursal, estimated_date, notes, lines } = input;

    if (!lines || lines.length === 0) {
      return { ok: false, message: "El carrito está vacío" };
    }
    if (lines.some((line) => line.id_supplier === null)) {
      return { ok: false, message: "Todas las líneas deben tener un proveedor asignado" };
    }
    if (lines.some((line) => line.quantity <= 0)) {
      return { ok: false, message: "La cantidad de cada línea debe ser mayor a cero" };
    }
    if (lines.some((line) => line.unit_price < 0)) {
      return { ok: false, message: "El precio unitario no puede ser negativo" };
    }

    const folios = await db.transaction(async (tx) => {
      // Valida que cada producto exista, esté activo y sea de la empresa; toma
      // los snapshots (nombre, código, marca, unidad, conversion_factor) desde la BD,
      // nunca desde lo que mandó el cliente.
      const productIds = [...new Set(lines.map((line) => line.id_product))];
      const productParams: Record<string, unknown> = { id_empresa };
      const productPlaceholders = productIds
        .map((id, index) => {
          productParams[`id_product_${index}`] = id;
          return `@id_product_${index}`;
        })
        .join(",");

      const productRows = await tx.queryParams(
        `SELECT [id_product],[name],[product_code],[brand],[id_unit_measurement],[pieces],[split]
           FROM [CentroPodologico].[inventory].[Products]
          WHERE [id_empresa] = @id_empresa
            AND [status] = 1
            AND [activo] = 1
            AND [id_product] IN (${productPlaceholders})`,
        productParams
      );
      const productById = new Map(productRows.map((product) => [product.id_product, product]));
      for (const line of lines) {
        if (!productById.has(line.id_product)) {
          throw new Error(
            `El producto con id ${line.id_product} no existe, no está activo o no pertenece a la empresa`
          );
        }
      }

      const id_batch = randomUUID();
      const now = buildDate(new Date());
      const year = new Date().getFullYear();
      const createdFolios: string[] = [];

      const linesBySupplier = new Map<number, ICreatePurchaseOrderLineInput[]>();
      for (const line of lines) {
        const supplierId = line.id_supplier as number; // ya validado como no-nulo arriba
        const supplierLines = linesBySupplier.get(supplierId) ?? [];
        supplierLines.push(line);
        linesBySupplier.set(supplierId, supplierLines);
      }

      for (const [id_supplier, supplierLines] of linesBySupplier) {
        // Consecutivo del folio serializado con HOLDLOCK sobre el rango año+empresa,
        // para minimizar colisiones bajo dos pedidos generados en simultáneo.
        const prefix = `PO-${year}-`;
        const countRows = await tx.queryParams(
          `SELECT COUNT(*) AS cnt
             FROM [CentroPodologico].[inventory].[purchase_orders] WITH (UPDLOCK, HOLDLOCK)
            WHERE [id_empresa] = @id_empresa
              AND [folio] LIKE @prefix + '%'`,
          { id_empresa, prefix }
        );
        const consecutive = Number(countRows[0]?.cnt ?? 0) + 1;
        const folio = `${prefix}${String(consecutive).padStart(4, "0")}`;

        const itemsToInsert = supplierLines.map((line) => {
          const product = productById.get(line.id_product)!;
          const conversionFactor = product.split ? Number(product.pieces) || 1 : 1;
          const lineTotal = round2(line.quantity * line.unit_price);
          return { line, product, conversionFactor, lineTotal };
        });
        const subtotal = round2(itemsToInsert.reduce((sum, item) => sum + item.lineTotal, 0));
        const tax = round2(subtotal * (TAX_RATE / 100));
        const total = round2(subtotal + tax);

        const orderResult = await tx.queryParams(
          `INSERT INTO [CentroPodologico].[inventory].[purchase_orders]
             ([folio],[id_batch],[id_empresa],[id_sucursal],[id_supplier],[id_status],
              [subtotal],[discount],[tax],[shipping_cost],[total],[tax_rate],
              [estimated_date],[notes],[id_user_created],[created_at],[status])
           OUTPUT inserted.id_purchase_order
           VALUES
             (@folio,@id_batch,@id_empresa,@id_sucursal,@id_supplier,1,
              @subtotal,0,@tax,0,@total,@tax_rate,
              @estimated_date,@notes,@id_user_created,@created_at,1)`,
          {
            folio,
            id_batch,
            id_empresa,
            id_sucursal,
            id_supplier,
            subtotal,
            tax,
            total,
            tax_rate: TAX_RATE,
            estimated_date: estimated_date || null,
            notes: notes || null,
            id_user_created: id_user,
            created_at: now,
          }
        );
        const id_purchase_order = orderResult[0].id_purchase_order;

        for (const { line, product, conversionFactor, lineTotal } of itemsToInsert) {
          await tx.queryParams(
            `INSERT INTO [CentroPodologico].[inventory].[purchase_order_items]
               ([id_purchase_order],[id_product],[product_name],[product_code],[brand],
                [id_unit_measurement],[conversion_factor],[quantity],[quantity_received],
                [unit_price],[discount],[line_total],[created_at])
             VALUES
               (@id_purchase_order,@id_product,@product_name,@product_code,@brand,
                @id_unit_measurement,@conversion_factor,@quantity,0,
                @unit_price,0,@line_total,@created_at)`,
            {
              id_purchase_order,
              id_product: line.id_product,
              product_name: product.name,
              product_code: product.product_code,
              brand: product.brand,
              id_unit_measurement: product.id_unit_measurement,
              conversion_factor: conversionFactor,
              quantity: line.quantity,
              unit_price: line.unit_price,
              line_total: lineTotal,
              created_at: now,
            }
          );
        }

        createdFolios.push(folio);
      }

      return createdFolios;
    });

    revalidatePath("/dashboard/pedidos");
    return { ok: true, data: { folios } };
  } catch (error) {
    console.log(error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al generar la orden de compra",
    };
  }
}

/** Fila del historial: encabezado de la orden + nombre del proveedor para mostrar. */
export interface IPurchaseOrderListItem extends IPurchaseOrder {
  supplier_name: string;
}

export interface IPurchaseOrdersFilters {
  id_sucursal: number;
  id_status?:  number | null;
  id_supplier?: number | null;
  date_from?:  string | null;
  date_to?:    string | null;
}

export async function getPurchaseOrders(
  filters: IPurchaseOrdersFilters
): Promise<ActionResult<IPurchaseOrderListItem[]>> {
  try {
    const { id_empresa } = await getActiveUser();
    const { id_sucursal, id_status, id_supplier, date_from, date_to } = filters;

    const conditions = [
      "po.[id_empresa] = @id_empresa",
      "po.[id_sucursal] = @id_sucursal",
      "po.[status] = 1",
    ];
    const params: Record<string, unknown> = { id_empresa, id_sucursal };

    if (id_status) {
      conditions.push("po.[id_status] = @id_status");
      params.id_status = id_status;
    }
    if (id_supplier) {
      conditions.push("po.[id_supplier] = @id_supplier");
      params.id_supplier = id_supplier;
    }
    if (date_from) {
      conditions.push("po.[created_at] >= @date_from");
      params.date_from = `${date_from} 00:00:00`;
    }
    if (date_to) {
      conditions.push("po.[created_at] <= @date_to");
      params.date_to = `${date_to} 23:59:59`;
    }

    const rows = await db.queryParams(
      `SELECT po.[id_purchase_order],
              po.[folio],
              po.[id_batch],
              po.[id_empresa],
              po.[id_sucursal],
              po.[id_supplier],
              po.[id_status],
              po.[subtotal],
              po.[discount],
              po.[tax],
              po.[shipping_cost],
              po.[total],
              po.[tax_rate],
              CONVERT(varchar(10), po.[estimated_date], 120) AS estimated_date,
              CONVERT(varchar(10), po.[delivery_date], 120) AS delivery_date,
              CONVERT(varchar(10), po.[invoice_date], 120) AS invoice_date,
              po.[invoice_url],
              po.[invoice_number],
              po.[notes],
              po.[id_user_created],
              CONVERT(varchar(19), po.[created_at], 120) AS created_at,
              CONVERT(varchar(19), po.[sent_at], 120) AS sent_at,
              CONVERT(varchar(19), po.[closed_at], 120) AS closed_at,
              po.[status],
              sup.[nombre_corto] AS supplier_name
         FROM [CentroPodologico].[inventory].[purchase_orders] po
         JOIN [CentroPodologico].[inventory].[proveedores] sup
           ON sup.[id_proveedor] = po.[id_supplier]
        WHERE ${conditions.join(" AND ")}
        ORDER BY po.[created_at] DESC`,
      params
    );

    return { ok: true, data: rows as IPurchaseOrderListItem[] };
  } catch {
    return { ok: false, message: "Error al obtener el historial de pedidos" };
  }
}

/** Detalle de una orden: encabezado + nombre del proveedor + líneas + bitácora de recepciones. */
export interface IPurchaseOrderDetailView extends IPurchaseOrder {
  supplier_name: string;
  items:         IPurchaseOrderItem[];
  receptions:    IPurchaseReception[];
}

export async function getPurchaseOrderById(
  id_purchase_order: number
): Promise<ActionResult<IPurchaseOrderDetailView>> {
  try {
    const { id_empresa } = await getActiveUser();

    const headerRows = await db.queryParams(
      `SELECT po.[id_purchase_order],
              po.[folio],
              po.[id_batch],
              po.[id_empresa],
              po.[id_sucursal],
              po.[id_supplier],
              po.[id_status],
              po.[subtotal],
              po.[discount],
              po.[tax],
              po.[shipping_cost],
              po.[total],
              po.[tax_rate],
              CONVERT(varchar(10), po.[estimated_date], 120) AS estimated_date,
              CONVERT(varchar(10), po.[delivery_date], 120) AS delivery_date,
              CONVERT(varchar(10), po.[invoice_date], 120) AS invoice_date,
              po.[invoice_url],
              po.[invoice_number],
              po.[notes],
              po.[id_user_created],
              CONVERT(varchar(19), po.[created_at], 120) AS created_at,
              CONVERT(varchar(19), po.[sent_at], 120) AS sent_at,
              CONVERT(varchar(19), po.[closed_at], 120) AS closed_at,
              po.[status],
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

    const items = await db.queryParams(
      `SELECT [id_purchase_order_item],
              [id_purchase_order],
              [id_product],
              [product_name],
              [product_code],
              [brand],
              [id_unit_measurement],
              [conversion_factor],
              [quantity],
              [quantity_received],
              [unit_price],
              [discount],
              [line_total],
              CONVERT(varchar(19), [created_at], 120) AS created_at
         FROM [CentroPodologico].[inventory].[purchase_order_items]
        WHERE [id_purchase_order] = @id_purchase_order
        ORDER BY [id_purchase_order_item]`,
      { id_purchase_order }
    );

    const receptions = await db.queryParams(
      `SELECT [id_reception],
              [id_purchase_order],
              [id_sucursal],
              [id_user],
              [notes],
              [is_final],
              CONVERT(varchar(19), [created_at], 120) AS created_at
         FROM [CentroPodologico].[inventory].[purchase_receptions]
        WHERE [id_purchase_order] = @id_purchase_order
        ORDER BY [created_at] DESC`,
      { id_purchase_order }
    );

    const data: IPurchaseOrderDetailView = {
      ...(headerRows[0] as IPurchaseOrder & { supplier_name: string }),
      items: items as IPurchaseOrderItem[],
      receptions: receptions as IPurchaseReception[],
    };

    return { ok: true, data };
  } catch {
    return { ok: false, message: "Error al obtener el detalle de la orden" };
  }
}
