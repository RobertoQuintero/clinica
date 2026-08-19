"use server";

import db from "@/database/connection";
import { applyStockMovement } from "@/lib/inventory/stock";
import { IAuthUser } from "@/interfaces/auth";
import { StockCountDecision, StockCountStatus, StockCountType } from "@/interfaces/stock_count";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

/** Roles con permiso para revisar y cerrar un conteo (mismo criterio que min_stock, spec 11). */
const SUPERVISOR_ROLE_IDS = [1, 4];
/** Movimientos de kardex propios del cierre de conteo (ver queries.txt, inventory.movements). */
const MOVEMENT_ENTRADA_POR_CONTEO = 11;
const MOVEMENT_SALIDA_POR_CONTEO = 12;

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
 * Sucursal/empresa/usuario activos derivados del servidor (cookie `sel_sucursal`
 * + JWT), nunca de un parámetro enviado por el cliente. Mismo patrón que
 * `getActiveSession` en app/dashboard/movimientos/actions.ts.
 */
async function getActiveSession(): Promise<{
  id_sucursal: number;
  id_empresa: number;
  id_user: number;
}> {
  const cookieStore = await cookies();
  const { id_sucursal: jwtSucursal, id_empresa, id_user } = await getActiveUser();
  const selCookie = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
  const id_sucursal = selCookie > 0 ? selCookie : jwtSucursal;
  return { id_sucursal, id_empresa, id_user };
}

/** Folio de presentación derivado del id, sin columna extra (mismo patrón que `MOV-{id_kardex}`). */
function buildStockCountFolio(id_stock_count: number): string {
  return `INV-${String(id_stock_count).padStart(5, "0")}`;
}

/**
 * Gate de la revisión dentro del propio server action (además del gate de rutas en
 * `proxy.ts`): protegerlo solo en cliente dejaría expuesto el endpoint que devuelve
 * el stock del sistema y las diferencias.
 */
async function assertSupervisorRole(): Promise<IAuthUser> {
  const user = await getActiveUser();
  if (!SUPERVISOR_ROLE_IDS.includes(user.id_role)) {
    throw new Error("Esta acción requiere permisos de supervisor");
  }
  return user;
}

/** Fila del listado de conteos. */
export interface IStockCountListItem {
  id_stock_count: number;
  folio:          string;          // "INV-00025", derivado del id
  count_type:     StockCountType;
  category_name:  string | null;
  status:         StockCountStatus;
  counter_name:   string;
  reviewer_name:  string | null;
  created_at:     string;
  items_total:    number;
  items_with_difference: number | null; // null para quien no es supervisor
}

/** Categoría con al menos un producto contable (fila en `inventory.stock`) en la sucursal. */
export interface ICountableCategory {
  id_category: number;
  name:        string;
}

/**
 * Listado de conteos de la sucursal seleccionada, más recientes primero.
 * `items_with_difference` solo se calcula para roles 1/4 (supervisores); el resto
 * nunca debe saber cuántas diferencias tuvo un conteo.
 */
export async function getStockCounts(
  id_sucursal: number
): Promise<ActionResult<IStockCountListItem[]>> {
  try {
    const { id_role } = await getActiveUser();
    const isSupervisor = SUPERVISOR_ROLE_IDS.includes(id_role);

    const rows = await db.queryParams(
      `SELECT sc.[id_stock_count],
              sc.[count_type],
              sc.[status],
              CONVERT(varchar(19), sc.[created_at], 120) AS created_at,
              uc.[nombre] AS counter_name,
              ur.[nombre] AS reviewer_name,
              cat.[name] AS category_name,
              items.[items_total],
              items.[items_with_difference]
         FROM [CentroPodologico].[inventory].[stock_counts] sc
         JOIN [CentroPodologico].[dbo].[users] uc ON uc.[id_user] = sc.[id_user_counter]
         LEFT JOIN [CentroPodologico].[dbo].[users] ur ON ur.[id_user] = sc.[id_user_reviewer]
         LEFT JOIN [CentroPodologico].[inventory].[categories] cat
           ON cat.[id_category] = sc.[id_category]
         CROSS APPLY (
             SELECT COUNT(*) AS items_total,
                    SUM(CASE WHEN sci.[needs_second_count] = 1 THEN 1 ELSE 0 END) AS items_with_difference
               FROM [CentroPodologico].[inventory].[stock_count_items] sci
              WHERE sci.[id_stock_count] = sc.[id_stock_count]
         ) items
        WHERE sc.[id_sucursal] = @id_sucursal
        ORDER BY sc.[id_stock_count] DESC`,
      { id_sucursal }
    );

    const data: IStockCountListItem[] = rows.map((row) => ({
      id_stock_count: row.id_stock_count,
      folio: buildStockCountFolio(row.id_stock_count),
      count_type: row.count_type,
      category_name: row.category_name,
      status: row.status,
      counter_name: row.counter_name,
      reviewer_name: row.reviewer_name,
      created_at: row.created_at,
      items_total: Number(row.items_total),
      items_with_difference: isSupervisor ? Number(row.items_with_difference ?? 0) : null,
    }));

    return { ok: true, data };
  } catch {
    return { ok: false, message: "Error al obtener los conteos" };
  }
}

/** Categorías con al menos un producto activo con fila en `inventory.stock` de la sucursal. */
export async function getCountableCategories(
  id_sucursal: number
): Promise<ActionResult<ICountableCategory[]>> {
  try {
    const { id_empresa } = await getActiveUser();
    const rows = await db.queryParams(
      `SELECT DISTINCT cat.[id_category], cat.[name]
         FROM [CentroPodologico].[inventory].[categories] cat
         JOIN [CentroPodologico].[inventory].[Products] p ON p.[id_category] = cat.[id_category]
         JOIN [CentroPodologico].[inventory].[stock] s
           ON s.[id_product] = p.[id_product] AND s.[id_sucursal] = @id_sucursal
        WHERE cat.[id_empresa] = @id_empresa
          AND cat.[status] = 1
          AND cat.[activo] = 1
          AND p.[activo] = 1
          AND p.[status] = 1
        ORDER BY cat.[name]`,
      { id_sucursal, id_empresa }
    );
    return { ok: true, data: rows as ICountableCategory[] };
  } catch {
    return { ok: false, message: "Error al obtener las categorías" };
  }
}

/** Conteo abierto (si lo hay) en la sucursal, para el aviso con enlace de "Nuevo conteo". */
export interface IOpenStockCount {
  id_stock_count: number;
  folio:          string;
  status:         StockCountStatus;
}

/**
 * Conteo no cerrado/cancelado más reciente de la sucursal, si existe. Usado por la
 * pantalla "Nuevo conteo" para mostrar el aviso con enlace en vez del formulario
 * (solo puede haber un conteo abierto por sucursal a la vez).
 */
export async function getOpenStockCount(
  id_sucursal: number
): Promise<ActionResult<IOpenStockCount | null>> {
  try {
    const rows = await db.queryParams(
      `SELECT TOP 1 [id_stock_count], [status]
         FROM [CentroPodologico].[inventory].[stock_counts]
        WHERE [id_sucursal] = @id_sucursal
          AND [status] NOT IN ('cerrado', 'cancelado')
        ORDER BY [id_stock_count] DESC`,
      { id_sucursal }
    );
    if (rows.length === 0) return { ok: true, data: null };
    return {
      ok: true,
      data: {
        id_stock_count: rows[0].id_stock_count,
        folio: buildStockCountFolio(rows[0].id_stock_count),
        status: rows[0].status as StockCountStatus,
      },
    };
  } catch {
    return { ok: false, message: "Error al verificar si hay un conteo abierto" };
  }
}

/**
 * Cuenta cuántos productos incluiría un conteo con este tipo/categoría en la
 * sucursal, sin generarlo — mismo filtro que usa `createStockCount` al insertar
 * las líneas, para que el número mostrado antes de generar sea exacto.
 */
export async function getCountableProductCount(
  id_sucursal: number,
  count_type: StockCountType,
  id_category: number | null
): Promise<ActionResult<{ product_count: number }>> {
  try {
    const { id_empresa } = await getActiveUser();
    const categoryFilter = count_type === "category" ? "AND p.[id_category] = @id_category" : "";
    const rows = await db.queryParams(
      `SELECT COUNT(*) AS product_count
         FROM [CentroPodologico].[inventory].[Products] p
         JOIN [CentroPodologico].[inventory].[stock] s
           ON s.[id_product] = p.[id_product] AND s.[id_sucursal] = @id_sucursal
        WHERE p.[id_empresa] = @id_empresa
          AND p.[activo] = 1
          AND p.[status] = 1
          ${categoryFilter}`,
      { id_sucursal, id_empresa, id_category }
    );
    return { ok: true, data: { product_count: Number(rows[0].product_count) } };
  } catch {
    return { ok: false, message: "Error al calcular los productos del conteo" };
  }
}

/**
 * Genera un nuevo conteo: valida que no haya otro abierto en la sucursal, congela el
 * snapshot de `inventory.stock` en `system_quantity` para cada producto incluido, y
 * deja el conteo en `en_captura`. `id_sucursal`, `id_empresa` e `id_user` vienen del
 * servidor (cookie `sel_sucursal` + JWT), nunca del cliente.
 */
export async function createStockCount(
  count_type: StockCountType,
  id_category: number | null
): Promise<ActionResult<{ id_stock_count: number }>> {
  try {
    if (count_type === "category" && !id_category) {
      return { ok: false, message: "Selecciona una categoría" };
    }

    const { id_sucursal, id_empresa, id_user } = await getActiveSession();

    const id_stock_count = await db.transaction(async (tx) => {
      // UPDLOCK + HOLDLOCK: evita que dos generaciones concurrentes en la misma
      // sucursal pasen ambas la validación de "sin conteo abierto".
      const openRows = await tx.queryParams(
        `SELECT [id_stock_count]
           FROM [CentroPodologico].[inventory].[stock_counts] WITH (UPDLOCK, HOLDLOCK)
          WHERE [id_sucursal] = @id_sucursal
            AND [status] NOT IN ('cerrado', 'cancelado')`,
        { id_sucursal }
      );
      if (openRows.length > 0) {
        const openFolio = buildStockCountFolio(Number(openRows[0].id_stock_count));
        throw new Error(`Ya existe un conteo abierto en esta sucursal (${openFolio})`);
      }

      const created_at = buildDate(new Date());
      const headerRows = await tx.queryParams(
        `INSERT INTO [CentroPodologico].[inventory].[stock_counts]
           ([id_sucursal],[id_empresa],[count_type],[id_category],[status],[id_user_counter],[created_at])
         OUTPUT inserted.id_stock_count
         VALUES (@id_sucursal, @id_empresa, @count_type, @id_category, 'en_captura', @id_user, @created_at)`,
        { id_sucursal, id_empresa, count_type, id_category, id_user, created_at }
      );
      const newId = Number(headerRows[0].id_stock_count);

      const categoryFilter = count_type === "category" ? "AND p.[id_category] = @id_category" : "";
      await tx.queryParams(
        `INSERT INTO [CentroPodologico].[inventory].[stock_count_items]
           ([id_stock_count],[id_product],[system_quantity])
         SELECT @id_stock_count, p.[id_product], s.[quantity]
           FROM [CentroPodologico].[inventory].[Products] p
           JOIN [CentroPodologico].[inventory].[stock] s
             ON s.[id_product] = p.[id_product] AND s.[id_sucursal] = @id_sucursal
          WHERE p.[id_empresa] = @id_empresa
            AND p.[activo] = 1
            AND p.[status] = 1
            ${categoryFilter}`,
        { id_stock_count: newId, id_sucursal, id_empresa, id_category }
      );

      return newId;
    });

    revalidatePath("/dashboard/conteos");
    return { ok: true, data: { id_stock_count } };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al crear el conteo",
    };
  }
}

/** Encabezado del conteo para las pantallas de captura (folio, tipo, estado, quien lo generó). */
export interface IStockCountHeader {
  id_stock_count: number;
  folio:          string;
  count_type:     StockCountType;
  category_name:  string | null;
  status:         StockCountStatus;
  counter_name:   string;
  created_at:     string;
}

/** Encabezado de un conteo puntual, validando que pertenezca a la sucursal/empresa activa. */
export async function getStockCountHeader(
  id_stock_count: number
): Promise<ActionResult<IStockCountHeader>> {
  try {
    const { id_sucursal, id_empresa } = await getActiveSession();
    const rows = await db.queryParams(
      `SELECT sc.[id_stock_count],
              sc.[count_type],
              sc.[status],
              CONVERT(varchar(19), sc.[created_at], 120) AS created_at,
              uc.[nombre] AS counter_name,
              cat.[name] AS category_name
         FROM [CentroPodologico].[inventory].[stock_counts] sc
         JOIN [CentroPodologico].[dbo].[users] uc ON uc.[id_user] = sc.[id_user_counter]
         LEFT JOIN [CentroPodologico].[inventory].[categories] cat
           ON cat.[id_category] = sc.[id_category]
        WHERE sc.[id_stock_count] = @id_stock_count
          AND sc.[id_sucursal] = @id_sucursal
          AND sc.[id_empresa] = @id_empresa`,
      { id_stock_count, id_sucursal, id_empresa }
    );
    if (rows.length === 0) {
      return { ok: false, message: "El conteo no existe o no pertenece a esta sucursal" };
    }
    const row = rows[0];
    return {
      ok: true,
      data: {
        id_stock_count: row.id_stock_count,
        folio: buildStockCountFolio(row.id_stock_count),
        count_type: row.count_type,
        category_name: row.category_name,
        status: row.status,
        counter_name: row.counter_name,
        created_at: row.created_at,
      },
    };
  } catch {
    return { ok: false, message: "Error al obtener el conteo" };
  }
}

/** Línea que ve QUIEN CAPTURA. Sin stock del sistema, sin diferencia. */
export interface ICountEntryLine {
  id_stock_count_item: number;
  id_product:          number;
  product_name:        string;
  product_code:        string;
  unit_code:           string | null;
  counted_quantity:    number | null;  // first_count o second_count según la etapa
}

/** Payload de una línea al guardar avance de captura. */
export interface ICountProgressLine {
  id_stock_count_item: number;
  counted_quantity:    number;
}

/**
 * Verifica que el conteo exista y pertenezca a la sucursal/empresa activas, y
 * devuelve su estado. Ownership compartido por todas las funciones de captura.
 */
async function assertStockCountOwnership(
  tx: { queryParams(consult: string, params: Record<string, unknown>): Promise<any[]> },
  id_stock_count: number,
  id_sucursal: number,
  id_empresa: number
): Promise<{ status: StockCountStatus; id_user_counter: number }> {
  const rows = await tx.queryParams(
    `SELECT [status], [id_user_counter]
       FROM [CentroPodologico].[inventory].[stock_counts]
      WHERE [id_stock_count] = @id_stock_count
        AND [id_sucursal] = @id_sucursal
        AND [id_empresa] = @id_empresa`,
    { id_stock_count, id_sucursal, id_empresa }
  );
  if (rows.length === 0) {
    throw new Error("El conteo no existe o no pertenece a esta sucursal");
  }
  return { status: rows[0].status as StockCountStatus, id_user_counter: Number(rows[0].id_user_counter) };
}

/**
 * Líneas de captura del conteo. Nunca selecciona `system_quantity`: es la garantía
 * estructural de que quien captura no puede ver el stock del sistema (spec 23).
 * - `en_captura`: todas las líneas, con `counted_quantity = first_count`.
 * - `segundo_conteo`: solo las líneas con diferencia, con `counted_quantity = second_count`.
 * - `pendiente_revision` / `cerrado` / `cancelado`: participación terminada; se
 *   muestra el valor definitivo de cada línea (`second_count` si lo hubo, si no
 *   `first_count`), para la vista de solo lectura — tampoco aquí se expone el
 *   stock del sistema ni la diferencia.
 */
export async function getCountEntryLines(
  id_stock_count: number
): Promise<ActionResult<ICountEntryLine[]>> {
  try {
    const { id_sucursal, id_empresa } = await getActiveSession();
    const { status } = await assertStockCountOwnership(db, id_stock_count, id_sucursal, id_empresa);

    let whereExtra = "";
    let quantityExpr: string;
    if (status === "en_captura") {
      quantityExpr = "sci.[first_count]";
    } else if (status === "segundo_conteo") {
      whereExtra = "AND sci.[needs_second_count] = 1";
      quantityExpr = "sci.[second_count]";
    } else {
      quantityExpr = "COALESCE(sci.[second_count], sci.[first_count])";
    }

    const rows = await db.queryParams(
      `SELECT sci.[id_stock_count_item],
              sci.[id_product],
              p.[name] AS product_name,
              p.[product_code],
              um.[code] AS unit_code,
              ${quantityExpr} AS counted_quantity
         FROM [CentroPodologico].[inventory].[stock_count_items] sci
         JOIN [CentroPodologico].[inventory].[Products] p ON p.[id_product] = sci.[id_product]
         LEFT JOIN [CentroPodologico].[inventory].[units_measurement] um
           ON um.[id_unit_measurement] = p.[id_stock_unit_measurement]
        WHERE sci.[id_stock_count] = @id_stock_count
          ${whereExtra}
        ORDER BY p.[name]`,
      { id_stock_count }
    );

    const data: ICountEntryLine[] = rows.map((row) => ({
      id_stock_count_item: row.id_stock_count_item,
      id_product: row.id_product,
      product_name: row.product_name,
      product_code: row.product_code,
      unit_code: row.unit_code,
      counted_quantity: row.counted_quantity === null ? null : Number(row.counted_quantity),
    }));

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al obtener las líneas del conteo",
    };
  }
}

/**
 * Guarda parcialmente las cantidades capturadas, sin cambiar el estado del conteo.
 * Escribe en `first_count` durante `en_captura` o en `second_count` durante
 * `segundo_conteo` (y, en ese caso, solo en líneas con `needs_second_count = 1`).
 */
export async function saveCountProgress(
  id_stock_count: number,
  lines: ICountProgressLine[]
): Promise<ActionResult<null>> {
  try {
    const { id_sucursal, id_empresa } = await getActiveSession();
    const { status } = await assertStockCountOwnership(db, id_stock_count, id_sucursal, id_empresa);

    if (status !== "en_captura" && status !== "segundo_conteo") {
      return { ok: false, message: "Este conteo ya no admite captura" };
    }

    const column = status === "en_captura" ? "first_count" : "second_count";
    const extraCondition = status === "segundo_conteo" ? "AND [needs_second_count] = 1" : "";

    await db.transaction(async (tx) => {
      for (const line of lines) {
        await tx.queryParams(
          `UPDATE [CentroPodologico].[inventory].[stock_count_items]
              SET [${column}] = @counted_quantity
            WHERE [id_stock_count_item] = @id_stock_count_item
              AND [id_stock_count] = @id_stock_count
              ${extraCondition}`,
          {
            counted_quantity: line.counted_quantity,
            id_stock_count_item: line.id_stock_count_item,
            id_stock_count,
          }
        );
      }
    });

    return { ok: true, data: null };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al guardar el avance del conteo",
    };
  }
}

/**
 * Cierra la participación de quien captura en el primer conteo: exige que todas
 * las líneas tengan `first_count`, calcula `needs_second_count` contra el
 * snapshot, y avanza a `segundo_conteo` (si hubo diferencias) o directo a
 * `pendiente_revision` (si no hubo ninguna).
 */
export async function finishFirstCount(
  id_stock_count: number
): Promise<ActionResult<{ status: StockCountStatus }>> {
  try {
    const { id_sucursal, id_empresa } = await getActiveSession();

    const status = await db.transaction(async (tx) => {
      const owned = await assertStockCountOwnership(tx, id_stock_count, id_sucursal, id_empresa);
      if (owned.status !== "en_captura") {
        throw new Error("Este conteo no está en la etapa de primer conteo");
      }

      const pendingRows = await tx.queryParams(
        `SELECT COUNT(*) AS pending
           FROM [CentroPodologico].[inventory].[stock_count_items]
          WHERE [id_stock_count] = @id_stock_count
            AND [first_count] IS NULL`,
        { id_stock_count }
      );
      if (Number(pendingRows[0].pending) > 0) {
        throw new Error("Faltan productos por capturar en el primer conteo");
      }

      await tx.queryParams(
        `UPDATE [CentroPodologico].[inventory].[stock_count_items]
            SET [needs_second_count] = CASE WHEN [first_count] <> [system_quantity] THEN 1 ELSE 0 END
          WHERE [id_stock_count] = @id_stock_count`,
        { id_stock_count }
      );

      const diffRows = await tx.queryParams(
        `SELECT COUNT(*) AS with_difference
           FROM [CentroPodologico].[inventory].[stock_count_items]
          WHERE [id_stock_count] = @id_stock_count
            AND [needs_second_count] = 1`,
        { id_stock_count }
      );
      const hasDifferences = Number(diffRows[0].with_difference) > 0;
      const newStatus: StockCountStatus = hasDifferences ? "segundo_conteo" : "pendiente_revision";

      if (hasDifferences) {
        await tx.queryParams(
          `UPDATE [CentroPodologico].[inventory].[stock_counts]
              SET [status] = 'segundo_conteo'
            WHERE [id_stock_count] = @id_stock_count`,
          { id_stock_count }
        );
      } else {
        const counted_at = buildDate(new Date());
        await tx.queryParams(
          `UPDATE [CentroPodologico].[inventory].[stock_counts]
              SET [status] = 'pendiente_revision', [counted_at] = @counted_at
            WHERE [id_stock_count] = @id_stock_count`,
          { id_stock_count, counted_at }
        );
      }

      return newStatus;
    });

    revalidatePath("/dashboard/conteos");
    revalidatePath(`/dashboard/conteos/${id_stock_count}`);
    return { ok: true, data: { status } };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al finalizar el primer conteo",
    };
  }
}

/**
 * Cierra la participación de quien captura en el segundo conteo: exige `second_count`
 * en todas las líneas con diferencia y avanza a `pendiente_revision`. Es definitivo,
 * aunque las líneas sigan difiriendo del sistema.
 */
export async function finishSecondCount(
  id_stock_count: number
): Promise<ActionResult<null>> {
  try {
    const { id_sucursal, id_empresa } = await getActiveSession();

    await db.transaction(async (tx) => {
      const owned = await assertStockCountOwnership(tx, id_stock_count, id_sucursal, id_empresa);
      if (owned.status !== "segundo_conteo") {
        throw new Error("Este conteo no está en la etapa de segundo conteo");
      }

      const pendingRows = await tx.queryParams(
        `SELECT COUNT(*) AS pending
           FROM [CentroPodologico].[inventory].[stock_count_items]
          WHERE [id_stock_count] = @id_stock_count
            AND [needs_second_count] = 1
            AND [second_count] IS NULL`,
        { id_stock_count }
      );
      if (Number(pendingRows[0].pending) > 0) {
        throw new Error("Faltan productos por recontar en el segundo conteo");
      }

      const counted_at = buildDate(new Date());
      await tx.queryParams(
        `UPDATE [CentroPodologico].[inventory].[stock_counts]
            SET [status] = 'pendiente_revision', [counted_at] = @counted_at
          WHERE [id_stock_count] = @id_stock_count`,
        { id_stock_count, counted_at }
      );
    });

    revalidatePath("/dashboard/conteos");
    revalidatePath(`/dashboard/conteos/${id_stock_count}`);
    return { ok: true, data: null };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al finalizar el segundo conteo",
    };
  }
}

/**
 * Cancela un conteo no cerrado (sin borrado físico). Permitido a quien lo capturó
 * y a los roles supervisores (1, 4); no toca stock.
 */
export async function cancelStockCount(
  id_stock_count: number
): Promise<ActionResult<null>> {
  try {
    const { id_sucursal, id_empresa, id_user } = await getActiveSession();
    const { id_role } = await getActiveUser();
    const isSupervisor = SUPERVISOR_ROLE_IDS.includes(id_role);

    await db.transaction(async (tx) => {
      const owned = await assertStockCountOwnership(tx, id_stock_count, id_sucursal, id_empresa);
      if (owned.status === "cerrado") {
        throw new Error("Un conteo cerrado no se puede cancelar");
      }
      if (owned.status === "cancelado") {
        throw new Error("Este conteo ya está cancelado");
      }
      if (!isSupervisor && owned.id_user_counter !== id_user) {
        throw new Error("No tienes permiso para cancelar este conteo");
      }

      const closed_at = buildDate(new Date());
      await tx.queryParams(
        `UPDATE [CentroPodologico].[inventory].[stock_counts]
            SET [status] = 'cancelado', [closed_at] = @closed_at
          WHERE [id_stock_count] = @id_stock_count`,
        { id_stock_count, closed_at }
      );
    });

    revalidatePath("/dashboard/conteos");
    return { ok: true, data: null };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al cancelar el conteo",
    };
  }
}

/** Cabecera del documento de referencia que ve el supervisor en la revisión. */
export interface IStockCountReviewHeader {
  id_stock_count: number;
  folio:          string;
  sucursal_name:  string;
  count_type:     StockCountType;
  category_name:  string | null;
  status:         StockCountStatus;
  counter_name:   string;
  created_at:     string;
  counted_at:     string | null;
}

/** Línea que ve EL SUPERVISOR. Solo se genera para líneas con diferencia. */
export interface ICountReviewLine {
  id_stock_count_item: number;
  id_product:          number;
  product_name:        string;
  product_code:        string;
  unit_code:           string | null;
  counted_quantity:    number;   // second_count ?? first_count
  system_quantity:     number;   // snapshot al generar
  current_stock:       number;   // stock vivo al momento de abrir la revisión
  difference:          number;   // counted_quantity - system_quantity
  decision:            StockCountDecision | null;
  reviewer_notes:      string | null;
}

export interface IStockCountReview {
  header: IStockCountReviewHeader;
  lines:  ICountReviewLine[];
}

/** Payload de una línea al guardar una decisión del supervisor. */
export interface IReviewDecisionInput {
  id_stock_count_item: number;
  decision:             StockCountDecision;
  reviewer_notes:       string | null;
}

/**
 * Encabezado + líneas con diferencia (`needs_second_count = 1`) de un conteo, con
 * `current_stock` leído en vivo de `inventory.stock`. Única función que expone
 * stock del sistema y diferencias — protegida por `assertSupervisorRole` además
 * del gate de `proxy.ts`.
 */
export async function getCountReview(
  id_stock_count: number
): Promise<ActionResult<IStockCountReview>> {
  try {
    await assertSupervisorRole();
    const { id_sucursal, id_empresa } = await getActiveSession();

    const headerRows = await db.queryParams(
      `SELECT sc.[id_stock_count],
              sc.[count_type],
              sc.[status],
              CONVERT(varchar(19), sc.[created_at], 120) AS created_at,
              CONVERT(varchar(19), sc.[counted_at], 120) AS counted_at,
              uc.[nombre] AS counter_name,
              cat.[name] AS category_name,
              suc.[nombre] AS sucursal_name
         FROM [CentroPodologico].[inventory].[stock_counts] sc
         JOIN [CentroPodologico].[dbo].[users] uc ON uc.[id_user] = sc.[id_user_counter]
         LEFT JOIN [CentroPodologico].[inventory].[categories] cat
           ON cat.[id_category] = sc.[id_category]
         JOIN [CentroPodologico].[dbo].[sucursales] suc ON suc.[id_sucursal] = sc.[id_sucursal]
        WHERE sc.[id_stock_count] = @id_stock_count
          AND sc.[id_sucursal] = @id_sucursal
          AND sc.[id_empresa] = @id_empresa`,
      { id_stock_count, id_sucursal, id_empresa }
    );
    if (headerRows.length === 0) {
      return { ok: false, message: "El conteo no existe o no pertenece a esta sucursal" };
    }
    const headerRow = headerRows[0];

    const lineRows = await db.queryParams(
      `SELECT sci.[id_stock_count_item],
              sci.[id_product],
              p.[name] AS product_name,
              p.[product_code],
              um.[code] AS unit_code,
              COALESCE(sci.[second_count], sci.[first_count]) AS counted_quantity,
              sci.[system_quantity],
              ISNULL(st.[quantity], 0) AS current_stock,
              sci.[decision],
              sci.[reviewer_notes]
         FROM [CentroPodologico].[inventory].[stock_count_items] sci
         JOIN [CentroPodologico].[inventory].[Products] p ON p.[id_product] = sci.[id_product]
         LEFT JOIN [CentroPodologico].[inventory].[units_measurement] um
           ON um.[id_unit_measurement] = p.[id_stock_unit_measurement]
         LEFT JOIN [CentroPodologico].[inventory].[stock] st
           ON st.[id_product] = sci.[id_product] AND st.[id_sucursal] = @id_sucursal
        WHERE sci.[id_stock_count] = @id_stock_count
          AND sci.[needs_second_count] = 1
        ORDER BY p.[name]`,
      { id_stock_count, id_sucursal }
    );

    const lines: ICountReviewLine[] = lineRows.map((row) => {
      const countedQuantity = Number(row.counted_quantity);
      const systemQuantity = Number(row.system_quantity);
      return {
        id_stock_count_item: row.id_stock_count_item,
        id_product: row.id_product,
        product_name: row.product_name,
        product_code: row.product_code,
        unit_code: row.unit_code,
        counted_quantity: countedQuantity,
        system_quantity: systemQuantity,
        current_stock: Number(row.current_stock),
        difference: countedQuantity - systemQuantity,
        decision: row.decision,
        reviewer_notes: row.reviewer_notes,
      };
    });

    const header: IStockCountReviewHeader = {
      id_stock_count: headerRow.id_stock_count,
      folio: buildStockCountFolio(headerRow.id_stock_count),
      sucursal_name: headerRow.sucursal_name,
      count_type: headerRow.count_type,
      category_name: headerRow.category_name,
      status: headerRow.status,
      counter_name: headerRow.counter_name,
      created_at: headerRow.created_at,
      counted_at: headerRow.counted_at,
    };

    return { ok: true, data: { header, lines } };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al obtener la revisión del conteo",
    };
  }
}

/**
 * Guarda parcialmente las decisiones del supervisor (`decision` + `reviewer_notes`
 * por línea), sin tocar stock. Rechaza si el conteo no está en `pendiente_revision`.
 */
export async function saveReviewDecisions(
  id_stock_count: number,
  decisions: IReviewDecisionInput[]
): Promise<ActionResult<null>> {
  try {
    await assertSupervisorRole();
    const { id_sucursal, id_empresa } = await getActiveSession();
    const owned = await assertStockCountOwnership(db, id_stock_count, id_sucursal, id_empresa);
    if (owned.status !== "pendiente_revision") {
      return { ok: false, message: "Este conteo no está en revisión" };
    }

    await db.transaction(async (tx) => {
      for (const decision of decisions) {
        await tx.queryParams(
          `UPDATE [CentroPodologico].[inventory].[stock_count_items]
              SET [decision] = @decision, [reviewer_notes] = @reviewer_notes
            WHERE [id_stock_count_item] = @id_stock_count_item
              AND [id_stock_count] = @id_stock_count
              AND [needs_second_count] = 1`,
          {
            decision: decision.decision,
            reviewer_notes: decision.reviewer_notes,
            id_stock_count_item: decision.id_stock_count_item,
            id_stock_count,
          }
        );
      }
    });

    return { ok: true, data: null };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al guardar las decisiones",
    };
  }
}

/**
 * Cierra el conteo: exige decisión en todas las líneas con diferencia y aplica, en
 * una sola transacción, un movimiento de kardex por cada línea `aumentar`/`disminuir`.
 * El ajuste se calcula contra el stock **vivo** al momento del cierre
 * (`|conteo_final − stock_actual|`), no contra el snapshot, para no pisar ventas,
 * consultas o recepciones ocurridas entre el conteo y la autorización.
 */
export async function closeStockCount(
  id_stock_count: number
): Promise<ActionResult<null>> {
  try {
    const supervisor = await assertSupervisorRole();
    const { id_sucursal, id_empresa } = await getActiveSession();

    await db.transaction(async (tx) => {
      const owned = await assertStockCountOwnership(tx, id_stock_count, id_sucursal, id_empresa);
      if (owned.status !== "pendiente_revision") {
        throw new Error("Este conteo no está en revisión");
      }

      const pendingRows = await tx.queryParams(
        `SELECT COUNT(*) AS pending
           FROM [CentroPodologico].[inventory].[stock_count_items]
          WHERE [id_stock_count] = @id_stock_count
            AND [needs_second_count] = 1
            AND [decision] IS NULL`,
        { id_stock_count }
      );
      if (Number(pendingRows[0].pending) > 0) {
        throw new Error("Faltan líneas con diferencia por decidir");
      }

      const adjustableLines = await tx.queryParams(
        `SELECT [id_stock_count_item],
                [id_product],
                COALESCE([second_count], [first_count]) AS counted_quantity,
                [reviewer_notes]
           FROM [CentroPodologico].[inventory].[stock_count_items]
          WHERE [id_stock_count] = @id_stock_count
            AND [needs_second_count] = 1
            AND [decision] IN ('aumentar', 'disminuir')`,
        { id_stock_count }
      );

      for (const line of adjustableLines) {
        // Relee el stock dentro de la transacción: el resultado final siempre se
        // calcula contra lo que hay ahora, no contra lo que el supervisor vio al decidir.
        const stockRows = await tx.queryParams(
          `SELECT [quantity]
             FROM [CentroPodologico].[inventory].[stock] WITH (UPDLOCK, HOLDLOCK)
            WHERE [id_product] = @id_product
              AND [id_sucursal] = @id_sucursal`,
          { id_product: line.id_product, id_sucursal }
        );
        const currentStock = stockRows.length > 0 ? Number(stockRows[0].quantity) : 0;
        const countedQuantity = Number(line.counted_quantity);
        const delta = countedQuantity - currentStock;

        if (delta === 0) continue;

        const id_movement = delta > 0 ? MOVEMENT_ENTRADA_POR_CONTEO : MOVEMENT_SALIDA_POR_CONTEO;
        await applyStockMovement(tx, {
          id_product: line.id_product,
          id_sucursal,
          id_empresa,
          id_movement,
          quantity: Math.abs(delta),
          id_stock_count,
          notes: line.reviewer_notes,
          unit_cost: null,
          id_user: supervisor.id_user,
        });

        const kardexRows = await tx.queryParams(
          `SELECT TOP 1 [id_kardex]
             FROM [CentroPodologico].[inventory].[kardex]
            WHERE [id_stock_count] = @id_stock_count
              AND [id_product] = @id_product
            ORDER BY [id_kardex] DESC`,
          { id_stock_count, id_product: line.id_product }
        );
        const id_kardex = kardexRows.length > 0 ? Number(kardexRows[0].id_kardex) : null;

        await tx.queryParams(
          `UPDATE [CentroPodologico].[inventory].[stock_count_items]
              SET [id_kardex] = @id_kardex
            WHERE [id_stock_count_item] = @id_stock_count_item`,
          { id_kardex, id_stock_count_item: line.id_stock_count_item }
        );
      }

      const closed_at = buildDate(new Date());
      await tx.queryParams(
        `UPDATE [CentroPodologico].[inventory].[stock_counts]
            SET [status] = 'cerrado', [id_user_reviewer] = @id_user_reviewer, [closed_at] = @closed_at
          WHERE [id_stock_count] = @id_stock_count`,
        { id_stock_count, id_user_reviewer: supervisor.id_user, closed_at }
      );
    });

    revalidatePath("/dashboard/conteos");
    revalidatePath("/dashboard/movimientos");
    return { ok: true, data: null };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al cerrar el conteo",
    };
  }
}
