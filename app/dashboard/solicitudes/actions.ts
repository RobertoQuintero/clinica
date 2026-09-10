"use server";

import db from "@/database/connection";
import { IAuthUser } from "@/interfaces/auth";
import {
  IPurchaseRequestDetail,
  IPurchaseRequestItem,
  IPurchaseRequestListItem,
  IRequestProduct,
  PURCHASE_REQUEST_STATUS,
} from "@/interfaces/purchase_request";
import { IPurchaseCartLine } from "@/contexts/PurchaseCartContext";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import {
  createPurchaseRequestSchema,
  rejectPurchaseRequestSchema,
  updatePurchaseRequestSchema,
} from "./schemas";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

/** Roles con permiso para revisar (confirmar/rechazar) una pre-solicitud. */
const REVIEWER_ROLE_IDS = [1, 4, 6];

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

/**
 * Gate de confirmar/rechazar dentro del propio server action, además del gate
 * de UI: ocultar los botones no impide invocar la action directamente.
 */
async function assertReviewerRole(): Promise<IAuthUser> {
  const user = await getActiveUser();
  if (!REVIEWER_ROLE_IDS.includes(user.id_role)) {
    throw new Error("Esta acción requiere permisos de compras");
  }
  return user;
}

/**
 * Catálogo de productos activos de la empresa para armar una pre-solicitud:
 * nombre/código/marca/categoría/unidad + stock actual de `id_sucursal` como
 * referencia. Deliberadamente SIN `price` ni `id_supplier` (a diferencia de
 * `getSuggestedProducts`): el rol 2 no debe recibir esos datos ni en el payload.
 */
export async function getProductsForRequest(
  id_sucursal: number
): Promise<ActionResult<IRequestProduct[]>> {
  try {
    const { id_empresa } = await getActiveUser();

    const rows = await db.queryParams(
      `SELECT p.[id_product],
              p.[name],
              p.[product_code],
              p.[brand],
              p.[id_category],
              p.[id_unit_measurement],
              ISNULL(s.[quantity], 0) AS current_stock
         FROM [CentroPodologico].[inventory].[Products] p
         LEFT JOIN [CentroPodologico].[inventory].[stock] s
                ON s.[id_product] = p.[id_product]
               AND s.[id_sucursal] = @id_sucursal
        WHERE p.[status] = 1
          AND p.[activo] = 1
          AND p.[id_empresa] = @id_empresa
        ORDER BY p.[name]`,
      { id_sucursal, id_empresa }
    );

    const data: IRequestProduct[] = rows.map((row) => ({
      id_product: row.id_product,
      name: row.name,
      product_code: row.product_code,
      brand: row.brand,
      id_category: row.id_category,
      id_unit_measurement: row.id_unit_measurement,
      current_stock: Number(row.current_stock ?? 0),
    }));

    return { ok: true, data };
  } catch {
    return { ok: false, message: "Error al obtener los productos" };
  }
}

/**
 * Solicitudes pendientes de `id_sucursal`, de cualquier usuario de la sucursal
 * (decisión explícita: es un pendiente operativo, no un expediente personal).
 */
export async function getPendingPurchaseRequests(
  id_sucursal: number
): Promise<ActionResult<IPurchaseRequestListItem[]>> {
  try {
    const { id_empresa } = await getActiveUser();

    const rows = await db.queryParams(
      `SELECT pr.[id_purchase_request],
              pr.[folio],
              pr.[id_empresa],
              pr.[id_sucursal],
              pr.[id_status_request],
              pr.[notes],
              pr.[rejection_reason],
              pr.[id_user_created],
              pr.[id_user_reviewed],
              CONVERT(varchar(19), pr.[created_at], 120) AS created_at,
              CONVERT(varchar(19), pr.[reviewed_at], 120) AS reviewed_at,
              pr.[status],
              u.[nombre] AS created_by_name,
              ISNULL(items.[items_count], 0) AS items_count
         FROM [CentroPodologico].[inventory].[purchase_requests] pr
         JOIN [CentroPodologico].[dbo].[users] u
           ON u.[id_user] = pr.[id_user_created]
         OUTER APPLY (
                SELECT COUNT(*) AS items_count
                  FROM [CentroPodologico].[inventory].[purchase_request_items] i
                 WHERE i.[id_purchase_request] = pr.[id_purchase_request]
              ) items
        WHERE pr.[id_empresa] = @id_empresa
          AND pr.[id_sucursal] = @id_sucursal
          AND pr.[id_status_request] = @pending
          AND pr.[status] = 1
        ORDER BY pr.[created_at] DESC`,
      { id_empresa, id_sucursal, pending: PURCHASE_REQUEST_STATUS.PENDING }
    );

    const data: IPurchaseRequestListItem[] = rows.map((row) => ({
      ...row,
      status: Boolean(row.status),
      items_count: Number(row.items_count ?? 0),
    }));

    return { ok: true, data };
  } catch {
    return { ok: false, message: "Error al obtener las solicitudes pendientes" };
  }
}

/** Cabecera + líneas de una solicitud, validando que sea de la empresa del usuario. */
export async function getPurchaseRequestDetail(
  id_purchase_request: number
): Promise<ActionResult<IPurchaseRequestDetail>> {
  try {
    const { id_empresa } = await getActiveUser();

    const headerRows = await db.queryParams(
      `SELECT pr.[id_purchase_request],
              pr.[folio],
              pr.[id_empresa],
              pr.[id_sucursal],
              pr.[id_status_request],
              pr.[notes],
              pr.[rejection_reason],
              pr.[id_user_created],
              pr.[id_user_reviewed],
              CONVERT(varchar(19), pr.[created_at], 120) AS created_at,
              CONVERT(varchar(19), pr.[reviewed_at], 120) AS reviewed_at,
              pr.[status],
              u.[nombre] AS created_by_name
         FROM [CentroPodologico].[inventory].[purchase_requests] pr
         JOIN [CentroPodologico].[dbo].[users] u
           ON u.[id_user] = pr.[id_user_created]
        WHERE pr.[id_purchase_request] = @id_purchase_request
          AND pr.[id_empresa] = @id_empresa`,
      { id_purchase_request, id_empresa }
    );

    if (headerRows.length === 0) {
      return { ok: false, message: "La solicitud no existe" };
    }

    const itemRows = await db.queryParams(
      `SELECT [id_purchase_request_item],
              [id_purchase_request],
              [id_product],
              [product_name],
              [product_code],
              [brand],
              [id_unit_measurement],
              [quantity],
              CONVERT(varchar(19), [created_at], 120) AS created_at
         FROM [CentroPodologico].[inventory].[purchase_request_items]
        WHERE [id_purchase_request] = @id_purchase_request
        ORDER BY [id_purchase_request_item]`,
      { id_purchase_request }
    );

    const header = headerRows[0];
    const data: IPurchaseRequestDetail = {
      ...header,
      status: Boolean(header.status),
      items_count: itemRows.length,
      items: itemRows.map((row) => ({ ...row, quantity: Number(row.quantity) })) as IPurchaseRequestItem[],
    };

    return { ok: true, data };
  } catch {
    return { ok: false, message: "Error al obtener el detalle de la solicitud" };
  }
}

/**
 * Valida que cada producto exista, esté activo y sea de la empresa, y devuelve
 * su snapshot (nombre/código/marca/unidad) tomado de la BD, nunca del cliente.
 * Lanza un `Error` (capturado por el caller) en el primer problema encontrado.
 */
async function resolveProductSnapshots(
  id_empresa: number,
  productIds: number[]
): Promise<Map<number, { name: string; product_code: string; brand: string; id_unit_measurement: number | null }>> {
  const uniqueIds = [...new Set(productIds)];
  const params: Record<string, unknown> = { id_empresa };
  const placeholders = uniqueIds
    .map((id, index) => {
      params[`id_product_${index}`] = id;
      return `@id_product_${index}`;
    })
    .join(",");

  const rows = await db.queryParams(
    `SELECT [id_product],[name],[product_code],[brand],[id_unit_measurement]
       FROM [CentroPodologico].[inventory].[Products]
      WHERE [id_empresa] = @id_empresa
        AND [status] = 1
        AND [activo] = 1
        AND [id_product] IN (${placeholders})`,
    params
  );

  const byId = new Map(rows.map((row) => [row.id_product, row]));
  for (const id_product of uniqueIds) {
    if (!byId.has(id_product)) {
      throw new Error(
        `El producto con id ${id_product} no existe, no está activo o no pertenece a la empresa`
      );
    }
  }
  return byId;
}

export interface ICreatePurchaseRequestInput {
  id_sucursal: number;
  notes?:      string | null;
  lines:       { id_product: number; quantity: number }[];
}

/** Crea una pre-solicitud (cabecera + líneas) en una sola transacción. */
export async function createPurchaseRequest(
  input: ICreatePurchaseRequestInput
): Promise<ActionResult<{ id_purchase_request: number; folio: string }>> {
  const parsed = createPurchaseRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { id_sucursal, notes, lines } = parsed.data;

  try {
    const { id_empresa, id_user } = await getActiveUser();

    const result = await db.transaction(async (tx) => {
      const productById = await resolveProductSnapshots(id_empresa, lines.map((line) => line.id_product));

      const now = buildDate(new Date());
      const year = new Date().getFullYear();
      const prefix = `SOL-${year}-`;

      // Consecutivo serializado con HOLDLOCK sobre año+empresa (mismo patrón que PO-).
      const countRows = await tx.queryParams(
        `SELECT COUNT(*) AS cnt
           FROM [CentroPodologico].[inventory].[purchase_requests] WITH (UPDLOCK, HOLDLOCK)
          WHERE [id_empresa] = @id_empresa
            AND [folio] LIKE @prefix + '%'`,
        { id_empresa, prefix }
      );
      const consecutive = Number(countRows[0]?.cnt ?? 0) + 1;
      const folio = `${prefix}${String(consecutive).padStart(4, "0")}`;

      const headerResult = await tx.queryParams(
        `INSERT INTO [CentroPodologico].[inventory].[purchase_requests]
           ([folio],[id_empresa],[id_sucursal],[id_status_request],[notes],
            [id_user_created],[created_at],[status])
         OUTPUT inserted.id_purchase_request
         VALUES
           (@folio,@id_empresa,@id_sucursal,@pending,@notes,
            @id_user_created,@created_at,1)`,
        {
          folio,
          id_empresa,
          id_sucursal,
          pending: PURCHASE_REQUEST_STATUS.PENDING,
          notes: notes || null,
          id_user_created: id_user,
          created_at: now,
        }
      );
      const id_purchase_request = headerResult[0].id_purchase_request;

      for (const line of lines) {
        const product = productById.get(line.id_product)!;
        await tx.queryParams(
          `INSERT INTO [CentroPodologico].[inventory].[purchase_request_items]
             ([id_purchase_request],[id_product],[product_name],[product_code],[brand],
              [id_unit_measurement],[quantity],[created_at])
           VALUES
             (@id_purchase_request,@id_product,@product_name,@product_code,@brand,
              @id_unit_measurement,@quantity,@created_at)`,
          {
            id_purchase_request,
            id_product: line.id_product,
            product_name: product.name,
            product_code: product.product_code,
            brand: product.brand,
            id_unit_measurement: product.id_unit_measurement,
            quantity: line.quantity,
            created_at: now,
          }
        );
      }

      return { id_purchase_request, folio };
    });

    revalidatePath("/dashboard/solicitudes");
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al crear la solicitud",
    };
  }
}

export interface IUpdatePurchaseRequestInput {
  id_purchase_request: number;
  notes?:              string | null;
  lines:               { id_product: number; quantity: number }[];
}

/**
 * Edita cantidades/notas de una solicitud propia mientras esté `Pendiente`.
 * Reemplaza las líneas completas (`DELETE` + `INSERT`), igual que las plantillas.
 */
export async function updatePurchaseRequest(
  input: IUpdatePurchaseRequestInput
): Promise<ActionResult<null>> {
  const parsed = updatePurchaseRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { id_purchase_request, notes, lines } = parsed.data;

  try {
    const { id_empresa, id_user } = await getActiveUser();

    await db.transaction(async (tx) => {
      const existingRows = await tx.queryParams(
        `SELECT [id_purchase_request]
           FROM [CentroPodologico].[inventory].[purchase_requests]
          WHERE [id_purchase_request] = @id_purchase_request
            AND [id_empresa] = @id_empresa
            AND [id_user_created] = @id_user
            AND [id_status_request] = @pending
            AND [status] = 1`,
        { id_purchase_request, id_empresa, id_user, pending: PURCHASE_REQUEST_STATUS.PENDING }
      );
      if (existingRows.length === 0) {
        throw new Error("La solicitud no existe, no te pertenece o ya no está pendiente");
      }

      const productById = await resolveProductSnapshots(id_empresa, lines.map((line) => line.id_product));
      const now = buildDate(new Date());

      await tx.queryParams(
        `UPDATE [CentroPodologico].[inventory].[purchase_requests]
            SET [notes] = @notes
          WHERE [id_purchase_request] = @id_purchase_request`,
        { id_purchase_request, notes: notes || null }
      );

      await tx.queryParams(
        `DELETE FROM [CentroPodologico].[inventory].[purchase_request_items]
          WHERE [id_purchase_request] = @id_purchase_request`,
        { id_purchase_request }
      );

      for (const line of lines) {
        const product = productById.get(line.id_product)!;
        await tx.queryParams(
          `INSERT INTO [CentroPodologico].[inventory].[purchase_request_items]
             ([id_purchase_request],[id_product],[product_name],[product_code],[brand],
              [id_unit_measurement],[quantity],[created_at])
           VALUES
             (@id_purchase_request,@id_product,@product_name,@product_code,@brand,
              @id_unit_measurement,@quantity,@created_at)`,
          {
            id_purchase_request,
            id_product: line.id_product,
            product_name: product.name,
            product_code: product.product_code,
            brand: product.brand,
            id_unit_measurement: product.id_unit_measurement,
            quantity: line.quantity,
            created_at: now,
          }
        );
      }
    });

    revalidatePath("/dashboard/solicitudes");
    revalidatePath(`/dashboard/solicitudes/${id_purchase_request}`);
    return { ok: true, data: null };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al actualizar la solicitud",
    };
  }
}

/** Cancela una solicitud propia mientras esté `Pendiente`. */
export async function cancelPurchaseRequest(
  id_purchase_request: number
): Promise<ActionResult<null>> {
  try {
    const { id_empresa, id_user } = await getActiveUser();

    const result = await db.queryParams(
      `UPDATE [CentroPodologico].[inventory].[purchase_requests]
          SET [id_status_request] = @cancelled
        OUTPUT inserted.id_purchase_request
        WHERE [id_purchase_request] = @id_purchase_request
          AND [id_empresa] = @id_empresa
          AND [id_user_created] = @id_user
          AND [id_status_request] = @pending
          AND [status] = 1`,
      {
        id_purchase_request,
        id_empresa,
        id_user,
        cancelled: PURCHASE_REQUEST_STATUS.CANCELLED,
        pending: PURCHASE_REQUEST_STATUS.PENDING,
      }
    );

    if (result.length === 0) {
      return { ok: false, message: "La solicitud no existe, no te pertenece o ya no está pendiente" };
    }

    revalidatePath("/dashboard/solicitudes");
    return { ok: true, data: null };
  } catch {
    return { ok: false, message: "Error al cancelar la solicitud" };
  }
}

/**
 * Pasa la solicitud de `Pendiente` a `Confirmada` (falla si afectó 0 filas, para
 * que recargar la URL no la confirme dos veces) y devuelve sus líneas ya mapeadas
 * a `IPurchaseCartLine`, tomando `id_supplier`/`price`/`pieces`/`split` del
 * producto **actual** (no del snapshot guardado al solicitar).
 */
export async function confirmPurchaseRequest(
  id_purchase_request: number
): Promise<ActionResult<{ folio: string; lines: IPurchaseCartLine[] }>> {
  try {
    const { id_empresa, id_user } = await assertReviewerRole();

    const result = await db.transaction(async (tx) => {
      const now = buildDate(new Date());

      const updateResult = await tx.queryParams(
        `UPDATE [CentroPodologico].[inventory].[purchase_requests]
            SET [id_status_request] = @confirmed,
                [id_user_reviewed]  = @id_user_reviewed,
                [reviewed_at]       = @reviewed_at
          OUTPUT inserted.id_purchase_request, inserted.folio
          WHERE [id_purchase_request] = @id_purchase_request
            AND [id_empresa] = @id_empresa
            AND [id_status_request] = @pending`,
        {
          id_purchase_request,
          id_empresa,
          confirmed: PURCHASE_REQUEST_STATUS.CONFIRMED,
          pending: PURCHASE_REQUEST_STATUS.PENDING,
          id_user_reviewed: id_user,
          reviewed_at: now,
        }
      );

      if (updateResult.length === 0) {
        throw new Error("La solicitud ya no está pendiente");
      }
      const folio = updateResult[0].folio as string;

      const itemRows = await tx.queryParams(
        `SELECT i.[id_product],
                i.[quantity],
                ISNULL(p.[name], i.[product_name])                 AS product_name,
                ISNULL(p.[product_code], i.[product_code])         AS product_code,
                ISNULL(p.[brand], i.[brand])                       AS brand,
                ISNULL(p.[id_unit_measurement], i.[id_unit_measurement]) AS id_unit_measurement,
                p.[id_supplier],
                p.[pieces],
                p.[split],
                p.[price]
           FROM [CentroPodologico].[inventory].[purchase_request_items] i
           LEFT JOIN [CentroPodologico].[inventory].[Products] p
             ON p.[id_product] = i.[id_product]
          WHERE i.[id_purchase_request] = @id_purchase_request`,
        { id_purchase_request }
      );

      const lines: IPurchaseCartLine[] = itemRows.map((row) => ({
        id_product: row.id_product,
        product_name: row.product_name,
        product_code: row.product_code,
        brand: row.brand,
        id_unit_measurement: row.id_unit_measurement,
        id_supplier: row.id_supplier ?? null,
        pieces: row.pieces ?? null,
        split: Boolean(row.split),
        quantity: Number(row.quantity),
        unit_price: Number(row.price ?? 0),
        applies_iva: true,
      }));

      return { folio, lines };
    });

    revalidatePath("/dashboard/solicitudes");
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al confirmar la solicitud",
    };
  }
}

/** Rechaza una solicitud pendiente. Motivo obligatorio (validado por zod). */
export async function rejectPurchaseRequest(
  input: { id_purchase_request: number; rejection_reason: string }
): Promise<ActionResult<null>> {
  const parsed = rejectPurchaseRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "El motivo de rechazo es obligatorio" };
  }
  const { id_purchase_request, rejection_reason } = parsed.data;

  try {
    const { id_empresa, id_user } = await assertReviewerRole();
    const now = buildDate(new Date());

    const result = await db.queryParams(
      `UPDATE [CentroPodologico].[inventory].[purchase_requests]
          SET [id_status_request] = @rejected,
              [rejection_reason]  = @rejection_reason,
              [id_user_reviewed]  = @id_user_reviewed,
              [reviewed_at]       = @reviewed_at
        OUTPUT inserted.id_purchase_request
        WHERE [id_purchase_request] = @id_purchase_request
          AND [id_empresa] = @id_empresa
          AND [id_status_request] = @pending`,
      {
        id_purchase_request,
        id_empresa,
        rejected: PURCHASE_REQUEST_STATUS.REJECTED,
        pending: PURCHASE_REQUEST_STATUS.PENDING,
        rejection_reason,
        id_user_reviewed: id_user,
        reviewed_at: now,
      }
    );

    if (result.length === 0) {
      return { ok: false, message: "La solicitud ya no está pendiente" };
    }

    revalidatePath("/dashboard/solicitudes");
    return { ok: true, data: null };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al rechazar la solicitud",
    };
  }
}

/** Conteo de solicitudes pendientes de `id_sucursal`, para el badge del sidebar. */
export async function getPendingRequestsCount(
  id_sucursal: number
): Promise<ActionResult<number>> {
  try {
    const { id_empresa } = await getActiveUser();

    const rows = await db.queryParams(
      `SELECT COUNT(*) AS cnt
         FROM [CentroPodologico].[inventory].[purchase_requests]
        WHERE [id_empresa] = @id_empresa
          AND [id_sucursal] = @id_sucursal
          AND [id_status_request] = @pending
          AND [status] = 1`,
      { id_empresa, id_sucursal, pending: PURCHASE_REQUEST_STATUS.PENDING }
    );

    return { ok: true, data: Number(rows[0]?.cnt ?? 0) };
  } catch {
    return { ok: false, message: "Error al obtener el conteo de solicitudes pendientes" };
  }
}
