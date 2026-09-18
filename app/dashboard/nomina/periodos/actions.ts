"use server";

import db from "@/database/connection";
import { IAuthUser } from "@/interfaces/auth";
import {
  IPayrollPeriodDates,
  IPayrollPeriodFilters,
  IPayrollPeriodRow,
  IPayrollPeriodsPage,
} from "@/interfaces/payroll_period";
import {
  PAYROLL_ALLOWED_ROLE_IDS,
  PAYROLL_FREQUENCY_LETTER_BY_SAT_KEY,
  PAYROLL_PERIODS_PAGE_SIZE,
} from "@/lib/payroll/constants";
import { suggestPeriodDates } from "@/lib/payroll/periodDates";
import { addZeroToday } from "@/utils/date_helpper";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

interface IPayrollSession {
  id_sucursal: number;
  id_user: number;
}

/** Frecuencia ofrecida en el selector: solo claves SAT con letra y regla de fechas definidas. */
export interface IPayrollFrequency {
  id_payment_period: number;
  clave_sat: string;
  description: string;
}

const PERIOD_ROW_SELECT = `
  p.id_period, p.id_sucursal, p.id_payment_period, p.codigo, p.ejercicio, p.consecutivo,
  CONVERT(varchar(10), p.fecha_inicio, 120) AS fecha_inicio,
  CONVERT(varchar(10), p.fecha_fin, 120)    AS fecha_fin,
  CONVERT(varchar(10), p.fecha_corte, 120)  AS fecha_corte,
  CONVERT(varchar(10), p.fecha_pago, 120)   AS fecha_pago,
  p.status, p.created_by,
  CONVERT(varchar(19), p.created_at, 120)   AS created_at,
  CONVERT(varchar(19), p.updated_at, 120)   AS updated_at,
  pp.description AS frecuencia_descripcion,
  pp.clave_sat   AS frecuencia_clave_sat`;

/**
 * Gate de rol dentro del propio server action (además de `proxy.ts`) y sucursal activa
 * derivada del servidor (cookie `sel_sucursal` con respaldo en el JWT), nunca del cliente.
 */
async function assertPayrollAccess(): Promise<ActionResult<IPayrollSession>> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return { ok: false, message: "No autenticado" };

  let user: IAuthUser;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    user = payload as unknown as IAuthUser;
  } catch {
    return { ok: false, message: "Sesión inválida" };
  }

  if (!PAYROLL_ALLOWED_ROLE_IDS.includes(user.id_role)) {
    return { ok: false, message: "No tienes permisos para acceder a Nómina" };
  }

  const selectedBranchId = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
  const id_sucursal = selectedBranchId > 0 ? selectedBranchId : user.id_sucursal;
  return { ok: true, data: { id_sucursal, id_user: user.id_user } };
}

async function queryAllowedFrequencies(): Promise<IPayrollFrequency[]> {
  const rows = (await db.query(
    `SELECT id_payment_period, clave_sat, description
       FROM [CentroPodologico].[RH].[payment_periods]
      WHERE status = 1
      ORDER BY id_payment_period`,
  )) as IPayrollFrequency[];
  return rows.filter((row) => row.clave_sat in PAYROLL_FREQUENCY_LETTER_BY_SAT_KEY);
}

export async function getPayrollFrequencies(): Promise<ActionResult<IPayrollFrequency[]>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  try {
    return { ok: true, data: await queryAllowedFrequencies() };
  } catch (error) {
    console.error("getPayrollFrequencies", error);
    return { ok: false, message: "No se pudieron cargar las frecuencias" };
  }
}

/** Escapa los comodines de LIKE para que la búsqueda por código sea literal. */
function escapeLikePattern(text: string): string {
  return text.replace(/[\[%_]/g, (character) => `[${character}]`);
}

export async function getPayrollPeriodsPage(
  filters: IPayrollPeriodFilters,
): Promise<ActionResult<IPayrollPeriodsPage>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal } = access.data;

  try {
    const today = addZeroToday(new Date());
    const page = Math.max(1, Math.floor(filters.page) || 1);

    const conditions = ["p.id_sucursal = @id_sucursal", "p.ejercicio = @ejercicio"];
    const params: Record<string, unknown> = {
      id_sucursal,
      ejercicio: filters.ejercicio,
    };
    if (filters.idPaymentPeriod !== null) {
      conditions.push("p.id_payment_period = @id_payment_period");
      params.id_payment_period = filters.idPaymentPeriod;
    }
    if (filters.status !== null) {
      conditions.push("p.status = @status");
      params.status = filters.status;
    }
    const search = filters.search.trim();
    if (search) {
      conditions.push("p.codigo LIKE @search ESCAPE '\\'");
      params.search = `%${escapeLikePattern(search)}%`;
    }
    const whereClause = conditions.join(" AND ");

    const [rows, totals, frequencyCounts, years, activeRows] = await Promise.all([
      db.queryParams(
        `SELECT ${PERIOD_ROW_SELECT}
           FROM [CentroPodologico].[payroll].[periods] p
           JOIN [CentroPodologico].[RH].[payment_periods] pp ON pp.id_payment_period = p.id_payment_period
          WHERE ${whereClause}
          ORDER BY p.fecha_inicio DESC, p.id_period DESC
         OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY`,
        { ...params, offset: (page - 1) * PAYROLL_PERIODS_PAGE_SIZE, page_size: PAYROLL_PERIODS_PAGE_SIZE },
      ),
      db.queryParams(
        `SELECT COUNT(*) AS total
           FROM [CentroPodologico].[payroll].[periods] p
          WHERE ${whereClause}`,
        params,
      ),
      db.queryParams(
        `SELECT p.id_payment_period, pp.description, COUNT(*) AS total
           FROM [CentroPodologico].[payroll].[periods] p
           JOIN [CentroPodologico].[RH].[payment_periods] pp ON pp.id_payment_period = p.id_payment_period
          WHERE p.id_sucursal = @id_sucursal AND p.ejercicio = @ejercicio
          GROUP BY p.id_payment_period, pp.description
          ORDER BY p.id_payment_period`,
        { id_sucursal, ejercicio: filters.ejercicio },
      ),
      db.queryParams(
        `SELECT DISTINCT ejercicio
           FROM [CentroPodologico].[payroll].[periods]
          WHERE id_sucursal = @id_sucursal`,
        { id_sucursal },
      ),
      db.queryParams(
        `SELECT TOP 1 ${PERIOD_ROW_SELECT}
           FROM [CentroPodologico].[payroll].[periods] p
           JOIN [CentroPodologico].[RH].[payment_periods] pp ON pp.id_payment_period = p.id_payment_period
          WHERE p.id_sucursal = @id_sucursal
            AND CAST(@today AS date) BETWEEN p.fecha_inicio AND p.fecha_fin
          ORDER BY p.fecha_inicio DESC, p.id_period DESC`,
        { id_sucursal, today },
      ),
    ]);

    const currentYear = Number(today.slice(0, 4));
    const availableYears = Array.from(
      new Set<number>([currentYear, ...years.map((row: { ejercicio: number }) => row.ejercicio)]),
    ).sort((yearA, yearB) => yearB - yearA);

    return {
      ok: true,
      data: {
        rows: rows as IPayrollPeriodRow[],
        totalRows: Number(totals[0]?.total ?? 0),
        frequencyCounts: frequencyCounts.map(
          (row: { id_payment_period: number; description: string; total: number }) => ({
            id_payment_period: row.id_payment_period,
            description: row.description,
            total: Number(row.total),
          }),
        ),
        availableYears,
        activePeriod: (activeRows[0] as IPayrollPeriodRow | undefined) ?? null,
      },
    };
  } catch (error) {
    console.error("getPayrollPeriodsPage", error);
    return { ok: false, message: "No se pudieron cargar los periodos de nómina" };
  }
}

export async function getSuggestedPeriodDates(
  idPaymentPeriod: number,
): Promise<ActionResult<IPayrollPeriodDates>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal } = access.data;

  try {
    const frequency = (await queryAllowedFrequencies()).find(
      (candidate) => candidate.id_payment_period === idPaymentPeriod,
    );
    if (!frequency) return { ok: false, message: "Frecuencia no permitida" };

    const rows = await db.queryParams(
      `SELECT CONVERT(varchar(10), MAX(fecha_fin), 120) AS last_end_date
         FROM [CentroPodologico].[payroll].[periods]
        WHERE id_sucursal = @id_sucursal AND id_payment_period = @id_payment_period`,
      { id_sucursal, id_payment_period: idPaymentPeriod },
    );
    const previousEndDate: string | null = rows[0]?.last_end_date ?? null;

    return {
      ok: true,
      data: suggestPeriodDates(frequency.clave_sat, previousEndDate, addZeroToday(new Date())),
    };
  } catch (error) {
    console.error("getSuggestedPeriodDates", error);
    return { ok: false, message: "No se pudieron calcular las fechas sugeridas" };
  }
}
