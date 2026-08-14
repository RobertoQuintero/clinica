"use server";

import db from "@/database/connection";
import { applyStockMovement } from "@/lib/inventory/stock";
import { IAuthUser } from "@/interfaces/auth";
import { toDBString, addZeroToday } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { randomUUID } from "crypto";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

/** Movimientos de kardex (ver queries.txt, inventory.movements). */
const MOVEMENT_SALIDA_POR_TRASPASO = 4;
const MOVEMENT_ENTRADA_POR_TRASPASO = 3;
/** Únicos tipos seleccionables manualmente en el modal "Registrar movimiento". */
const SELECTABLE_MOVEMENT_IDS = [2, MOVEMENT_SALIDA_POR_TRASPASO, 7, 8, 9];

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
 * `getTodaysCitas` en app/dashboard/actions.ts.
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

/** Fila del listado: kardex + datos desnormalizados para pintar la tabla. */
export interface IStockMovementListItem {
  id_kardex:         number;
  created_at:         string;
  id_movement:        number;
  movement_name:      string;
  increases_storage:  boolean;
  id_product:         number;
  product_name:       string;
  product_code:       string;
  quantity:           number;
  balance_after:      number;
  unit_code:          string | null;
  counterpart_name:   string | null;
  user_name:          string;
  notes:              string | null;
}

/** Respuesta paginada del listado. */
export interface IStockMovementsPage {
  items:     IStockMovementListItem[];
  total:     number;
  page:      number;
  page_size: number;
}

/** KPIs de cabecera: unidades entradas/salidas del día en la sucursal. */
export interface IStockMovementsSummary {
  units_in_today:  number;
  units_out_today: number;
}

/** Filtros del listado (todos opcionales salvo la sucursal). */
export interface IStockMovementsFilter {
  id_sucursal: number;
  search:      string | null;
  id_movement: number | null;
  date_from:   string | null;
  date_to:     string | null;
  page:        number;
  page_size:   number;
}

/** Catálogo de `inventory.movements`, para el filtro (todos) y el select del modal. */
export interface IMovementType {
  id_movement:       number;
  name:              string;
  short_name:        string;
  increases_storage: boolean;
}

/** Producto candidato en el buscador del modal, con el stock actual de la sucursal. */
export interface IMovementProductOption {
  id_product:                 number;
  name:                       string;
  product_code:               string;
  id_stock_unit_measurement: number | null;
  unit_code:                  string | null;
  current_stock:               number;
}

/** Sucursal destino disponible para un traspaso. */
export interface ITransferDestination {
  id_sucursal: number;
  nombre:      string;
}

/** Payload del modal de captura. */
export interface IRegisterMovementInput {
  id_movement:              number;
  id_product:               number;
  quantity:                 number;
  id_sucursal_destination: number | null;
  notes:                    string | null;
}

/** Listado paginado del kardex de la sucursal seleccionada, con filtros en servidor. */
export async function getStockMovements(
  filter: IStockMovementsFilter
): Promise<ActionResult<IStockMovementsPage>> {
  try {
    const { id_empresa } = await getActiveUser();
    const page = filter.page > 0 ? filter.page : 1;
    const pageSize = filter.page_size > 0 ? filter.page_size : 25;
    const offset = (page - 1) * pageSize;

    const today = addZeroToday(new Date());
    const dateFrom = toDBString(`${filter.date_from || today} 00:00:00`);
    const dateTo = toDBString(`${filter.date_to || today} 23:59:59`);

    const params: Record<string, unknown> = {
      id_sucursal: filter.id_sucursal,
      id_empresa,
      date_from: dateFrom,
      date_to: dateTo,
    };

    let whereExtra = "";
    if (filter.id_movement) {
      whereExtra += ` AND k.[id_movement] = @id_movement`;
      params.id_movement = filter.id_movement;
    }
    if (filter.search) {
      whereExtra += ` AND (p.[name] LIKE @search OR p.[product_code] LIKE @search)`;
      params.search = `%${filter.search}%`;
    }

    const whereClause = `
      WHERE k.[id_sucursal] = @id_sucursal
        AND k.[id_empresa] = @id_empresa
        AND k.[created_at] >= @date_from
        AND k.[created_at] <= @date_to
        ${whereExtra}`;

    const countRows = await db.queryParams(
      `SELECT COUNT(*) AS total
         FROM [CentroPodologico].[inventory].[kardex] k
         JOIN [CentroPodologico].[inventory].[Products] p ON p.[id_product] = k.[id_product]
         ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await db.queryParams(
      `SELECT k.[id_kardex],
              CONVERT(varchar(19), k.[created_at], 120) AS created_at,
              k.[id_movement],
              m.[name] AS movement_name,
              m.[increases_storage],
              k.[id_product],
              p.[name] AS product_name,
              p.[product_code],
              k.[quantity],
              k.[balance_after],
              um.[code] AS unit_code,
              sc.[nombre] AS counterpart_name,
              u.[nombre] AS user_name,
              k.[notes]
         FROM [CentroPodologico].[inventory].[kardex] k
         JOIN [CentroPodologico].[inventory].[movements] m ON m.[id_movement] = k.[id_movement]
         JOIN [CentroPodologico].[inventory].[Products] p ON p.[id_product] = k.[id_product]
         JOIN [CentroPodologico].[dbo].[users] u ON u.[id_user] = k.[id_user]
         LEFT JOIN [CentroPodologico].[inventory].[units_measurement] um
           ON um.[id_unit_measurement] = k.[id_unit_measurement]
         LEFT JOIN [CentroPodologico].[dbo].[sucursales] sc
           ON sc.[id_sucursal] = k.[id_sucursal_counterpart]
         ${whereClause}
        ORDER BY k.[id_kardex] DESC
        OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY`,
      { ...params, offset, page_size: pageSize }
    );

    const items: IStockMovementListItem[] = rows.map((row) => ({
      id_kardex: row.id_kardex,
      created_at: row.created_at,
      id_movement: row.id_movement,
      movement_name: row.movement_name,
      increases_storage: Boolean(row.increases_storage),
      id_product: row.id_product,
      product_name: row.product_name,
      product_code: row.product_code,
      quantity: Number(row.quantity),
      balance_after: Number(row.balance_after),
      unit_code: row.unit_code,
      counterpart_name: row.counterpart_name,
      user_name: row.user_name,
      notes: row.notes,
    }));

    return { ok: true, data: { items, total, page, page_size: pageSize } };
  } catch {
    return { ok: false, message: "Error al obtener los movimientos de almacén" };
  }
}

/** Suma de unidades entradas/salidas del día actual en la sucursal (KPIs de cabecera). */
export async function getMovementsSummary(
  id_sucursal: number
): Promise<ActionResult<IStockMovementsSummary>> {
  try {
    const { id_empresa } = await getActiveUser();
    const today = addZeroToday(new Date());
    const dateFrom = toDBString(`${today} 00:00:00`);
    const dateTo = toDBString(`${today} 23:59:59`);

    const rows = await db.queryParams(
      `SELECT m.[increases_storage], SUM(k.[quantity]) AS total_quantity
         FROM [CentroPodologico].[inventory].[kardex] k
         JOIN [CentroPodologico].[inventory].[movements] m ON m.[id_movement] = k.[id_movement]
        WHERE k.[id_sucursal] = @id_sucursal
          AND k.[id_empresa] = @id_empresa
          AND k.[created_at] >= @date_from
          AND k.[created_at] <= @date_to
        GROUP BY m.[increases_storage]`,
      { id_sucursal, id_empresa, date_from: dateFrom, date_to: dateTo }
    );

    let unitsIn = 0;
    let unitsOut = 0;
    for (const row of rows) {
      if (row.increases_storage) unitsIn = Number(row.total_quantity);
      else unitsOut = Number(row.total_quantity);
    }

    return { ok: true, data: { units_in_today: unitsIn, units_out_today: unitsOut } };
  } catch {
    return { ok: false, message: "Error al obtener el resumen de movimientos" };
  }
}

/** Catálogo completo de `inventory.movements` activos (filtro y select del modal). */
export async function getMovementTypes(): Promise<ActionResult<IMovementType[]>> {
  try {
    const { id_empresa } = await getActiveUser();
    const rows = await db.queryParams(
      `SELECT [id_movement], [name], [short_name], [increases_storage]
         FROM [CentroPodologico].[inventory].[movements]
        WHERE [status] = 1
          AND [activo] = 1
          AND [id_empresa] = @id_empresa
        ORDER BY [id_movement]`,
      { id_empresa }
    );
    const data: IMovementType[] = rows.map((row) => ({
      id_movement: row.id_movement,
      name: row.name,
      short_name: row.short_name,
      increases_storage: Boolean(row.increases_storage),
    }));
    return { ok: true, data };
  } catch {
    return { ok: false, message: "Error al obtener los tipos de movimiento" };
  }
}

/**
 * Productos activos de la empresa que hacen match con `search`, con el stock actual
 * en `id_sucursal`. No excluye `auto_consume = 1` (spec 14): un insumo de consumo
 * automático también puede requerir un ajuste manual.
 */
export async function searchProductsForMovement(
  id_sucursal: number,
  search: string
): Promise<ActionResult<IMovementProductOption[]>> {
  try {
    const { id_empresa } = await getActiveUser();
    const rows = await db.queryParams(
      `SELECT p.[id_product],
              p.[name],
              p.[product_code],
              p.[id_stock_unit_measurement],
              um.[code] AS unit_code,
              ISNULL(s.[quantity], 0) AS current_stock
         FROM [CentroPodologico].[inventory].[Products] p
         LEFT JOIN [CentroPodologico].[inventory].[units_measurement] um
           ON um.[id_unit_measurement] = p.[id_stock_unit_measurement]
         LEFT JOIN [CentroPodologico].[inventory].[stock] s
           ON s.[id_product] = p.[id_product] AND s.[id_sucursal] = @id_sucursal
        WHERE p.[id_empresa] = @id_empresa
          AND p.[activo] = 1
          AND p.[status] = 1
          AND (p.[name] LIKE @search OR p.[product_code] LIKE @search)
        ORDER BY p.[name]`,
      { id_sucursal, id_empresa, search: `%${search}%` }
    );
    const data: IMovementProductOption[] = rows.map((row) => ({
      id_product: row.id_product,
      name: row.name,
      product_code: row.product_code,
      id_stock_unit_measurement: row.id_stock_unit_measurement,
      unit_code: row.unit_code,
      current_stock: Number(row.current_stock),
    }));
    return { ok: true, data };
  } catch {
    return { ok: false, message: "Error al buscar productos" };
  }
}

/** Sucursales activas de la empresa disponibles como destino de un traspaso. */
export async function getTransferDestinations(
  id_sucursal_origin: number
): Promise<ActionResult<ITransferDestination[]>> {
  try {
    const { id_empresa } = await getActiveUser();
    const rows = await db.queryParams(
      `SELECT [id_sucursal], [nombre]
         FROM [CentroPodologico].[dbo].[sucursales]
        WHERE [id_empresa] = @id_empresa
          AND [activo] = 1
          AND [status] = 1
          AND [id_sucursal] <> @id_sucursal_origin
        ORDER BY [nombre]`,
      { id_empresa, id_sucursal_origin }
    );
    return { ok: true, data: rows as ITransferDestination[] };
  } catch {
    return { ok: false, message: "Error al obtener las sucursales destino" };
  }
}

/**
 * Registra un movimiento manual de stock (ajuste, merma, devolución o traspaso).
 * `id_sucursal`, `id_empresa` e `id_user` se toman del servidor (cookie `sel_sucursal`
 * + JWT), nunca del cliente. El stock puede quedar negativo: la advertencia vive en
 * el modal, no bloquea el guardado (ver spec 14).
 */
export async function registerStockMovement(
  input: IRegisterMovementInput
): Promise<ActionResult<null>> {
  try {
    if (!SELECTABLE_MOVEMENT_IDS.includes(input.id_movement)) {
      return { ok: false, message: "Tipo de movimiento no válido" };
    }
    if (!(input.quantity > 0)) {
      return { ok: false, message: "La cantidad debe ser mayor a cero" };
    }
    if (
      input.id_movement === MOVEMENT_SALIDA_POR_TRASPASO &&
      !input.id_sucursal_destination
    ) {
      return { ok: false, message: "Selecciona la sucursal destino del traspaso" };
    }

    const { id_sucursal, id_empresa, id_user } = await getActiveSession();

    if (
      input.id_movement === MOVEMENT_SALIDA_POR_TRASPASO &&
      input.id_sucursal_destination === id_sucursal
    ) {
      return { ok: false, message: "La sucursal destino debe ser distinta de la origen" };
    }

    await db.transaction(async (tx) => {
      const productRows = await tx.queryParams(
        `SELECT [id_product], [id_stock_unit_measurement]
           FROM [CentroPodologico].[inventory].[Products]
          WHERE [id_product] = @id_product
            AND [id_empresa] = @id_empresa
            AND [activo] = 1
            AND [status] = 1`,
        { id_product: input.id_product, id_empresa }
      );
      if (productRows.length === 0) {
        throw new Error("El producto no existe o no está activo");
      }
      const product = productRows[0];

      if (input.id_movement !== MOVEMENT_SALIDA_POR_TRASPASO) {
        await applyStockMovement(tx, {
          id_product: input.id_product,
          id_sucursal,
          id_empresa,
          id_movement: input.id_movement,
          quantity: input.quantity,
          id_unit_measurement: product.id_stock_unit_measurement ?? null,
          unit_cost: null,
          notes: input.notes || null,
          id_user,
        });
        return;
      }

      // Traspaso: la sucursal destino debe existir, estar activa y pertenecer a la empresa.
      const destinationRows = await tx.queryParams(
        `SELECT [id_sucursal]
           FROM [CentroPodologico].[dbo].[sucursales]
          WHERE [id_sucursal] = @id_sucursal_destination
            AND [id_empresa] = @id_empresa
            AND [activo] = 1
            AND [status] = 1`,
        { id_sucursal_destination: input.id_sucursal_destination, id_empresa }
      );
      if (destinationRows.length === 0) {
        throw new Error("La sucursal destino no es válida");
      }

      const id_transfer = randomUUID();

      await applyStockMovement(tx, {
        id_product: input.id_product,
        id_sucursal,
        id_empresa,
        id_movement: MOVEMENT_SALIDA_POR_TRASPASO,
        quantity: input.quantity,
        id_unit_measurement: product.id_stock_unit_measurement ?? null,
        unit_cost: null,
        id_sucursal_counterpart: input.id_sucursal_destination,
        id_transfer,
        notes: input.notes || null,
        id_user,
      });

      await applyStockMovement(tx, {
        id_product: input.id_product,
        id_sucursal: input.id_sucursal_destination!,
        id_empresa,
        id_movement: MOVEMENT_ENTRADA_POR_TRASPASO,
        quantity: input.quantity,
        id_unit_measurement: product.id_stock_unit_measurement ?? null,
        unit_cost: null,
        id_sucursal_counterpart: id_sucursal,
        id_transfer,
        notes: input.notes || null,
        id_user,
      });
    });

    revalidatePath("/dashboard/movimientos");
    return { ok: true, data: null };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error al registrar el movimiento",
    };
  }
}
