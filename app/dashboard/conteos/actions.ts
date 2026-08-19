"use server";

import db from "@/database/connection";
import { IAuthUser } from "@/interfaces/auth";
import { StockCountStatus, StockCountType } from "@/interfaces/stock_count";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

/** Roles con permiso para revisar y cerrar un conteo (mismo criterio que min_stock, spec 11). */
const SUPERVISOR_ROLE_IDS = [1, 4];

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

/** Fila del listado de conteos. */
export interface IStockCountListItem {
  id_stock_count: number;
  folio:          string;          // "INV-00025", derivado del id
  count_type:     StockCountType;
  category_name:  string | null;
  status:         string;
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
         LEFT JOIN [CentroPodologico].[inventory].[product_categories] cat
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
         FROM [CentroPodologico].[inventory].[product_categories] cat
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
