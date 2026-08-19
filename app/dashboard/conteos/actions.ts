"use server";

import db from "@/database/connection";
import { IAuthUser } from "@/interfaces/auth";
import { StockCountType } from "@/interfaces/stock_count";
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
