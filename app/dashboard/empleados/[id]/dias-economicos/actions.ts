"use server";

import db from "@/database/connection";
import { getEmployeeById } from "@/app/dashboard/empleados/actions";
import { getEmployeeWorkingWeekdays } from "@/app/dashboard/empleados/[id]/vacaciones/actions";
import { IEconomicDay } from "@/interfaces/economic_day";
import {
  ECONOMIC_DAYS_PER_YEAR,
  getCalendarYearRange,
  isWorkingDate,
} from "@/lib/economicDays/economicDayRules";
import { assertVacationAccess } from "@/lib/vacations/vacationAccess";
import { addZeroToday, buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import { cancelEconomicDaySchema, registerEconomicDaySchema } from "./schemas";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function revalidateEconomicDayViews(id_empleado: number) {
  revalidatePath(`/dashboard/empleados/${id_empleado}`, "layout");
  revalidatePath("/dashboard/empleados");
}

/** Todos los días económicos del empleado (activos y cancelados), de la fecha más reciente a la más antigua. */
export async function getEmployeeEconomicDays(id_empleado: number): Promise<IEconomicDay[]> {
  // getEmployeeById valida empresa y sucursales del usuario; sin acceso no se expone nada.
  const employee = await getEmployeeById(id_empleado);
  if (!employee) return [];

  return (await db.queryParams(
    `SELECT ed.[id_economic_day],
            ed.[id_empleado],
            CONVERT(varchar(10), ed.[fecha], 120)        AS fecha,
            ed.[motivo],
            creator.[nombre]                             AS created_by_name,
            CONVERT(varchar(19), ed.[created_at], 120)   AS created_at,
            canceller.[nombre]                           AS cancelado_by_name,
            CONVERT(varchar(19), ed.[cancelado_at], 120) AS cancelado_at,
            ed.[motivo_cancelacion]
       FROM [CentroPodologico].[RH].[economic_days] ed
       LEFT JOIN [CentroPodologico].[dbo].[users] creator   ON creator.[id_user]   = ed.[created_by]
       LEFT JOIN [CentroPodologico].[dbo].[users] canceller ON canceller.[id_user] = ed.[cancelado_by]
      WHERE ed.[id_empleado] = @id_empleado
      ORDER BY ed.[fecha] DESC, ed.[id_economic_day] DESC`,
    { id_empleado }
  )) as IEconomicDay[];
}

/**
 * Registra un día económico (spec 79). Las reglas de fecha se validan antes; el límite anual y la
 * unicidad por fecha se validan dentro del propio `INSERT … SELECT` con `UPDLOCK, HOLDLOCK`, para que
 * dos capturas simultáneas no pasen de `ECONOMIC_DAYS_PER_YEAR`.
 */
export async function registerEconomicDay(input: unknown): Promise<ActionResult<null>> {
  try {
    const access = await assertVacationAccess();
    if (!access.ok) return access;

    const parsed = registerEconomicDaySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { id_empleado, fecha, motivo } = parsed.data;

    const employee = await getEmployeeById(id_empleado);
    if (!employee) return { ok: false, message: "El empleado no existe o no tienes acceso a él" };
    if (!employee.activo) return { ok: false, message: "El empleado está inactivo" };

    const today = addZeroToday(new Date());
    const currentYear = Number(today.slice(0, 4));
    if (Number(fecha.slice(0, 4)) !== currentYear) {
      return { ok: false, message: "Solo se pueden registrar días del año en curso" };
    }

    const workingWeekdays = await getEmployeeWorkingWeekdays(id_empleado);
    if (workingWeekdays.length === 0) {
      return { ok: false, message: "Sin horario definido: captura el horario del empleado primero" };
    }
    if (!isWorkingDate(fecha, workingWeekdays)) {
      return { ok: false, message: "Esa fecha no es un día laborable del empleado" };
    }

    const [vacationOnDate] = (await db.queryParams(
      `SELECT TOP 1 1 AS is_on_vacation
         FROM [CentroPodologico].[RH].[vacation_entitlements]
        WHERE [id_empleado] = @id_empleado
          AND [fecha_inicio] IS NOT NULL
          AND @fecha BETWEEN [fecha_inicio] AND [fecha_fin]`,
      { id_empleado, fecha }
    )) as { is_on_vacation: number }[];
    if (vacationOnDate) {
      return { ok: false, message: "Ese día está dentro de las vacaciones del empleado" };
    }

    const { start, endExclusive } = getCalendarYearRange(currentYear);
    const insertedRows = await db.transaction((tx) =>
      tx.queryParams(
        `INSERT INTO [CentroPodologico].[RH].[economic_days]
           ([id_empleado], [fecha], [motivo], [created_by], [created_at])
         OUTPUT INSERTED.[id_economic_day]
         SELECT @id_empleado, @fecha, @motivo, @id_user, @created_at
          WHERE NOT EXISTS (SELECT 1
                              FROM [CentroPodologico].[RH].[economic_days] WITH (UPDLOCK, HOLDLOCK)
                             WHERE [id_empleado] = @id_empleado
                               AND [fecha] = @fecha
                               AND [cancelado_at] IS NULL)
            AND (SELECT COUNT(*)
                   FROM [CentroPodologico].[RH].[economic_days] WITH (UPDLOCK, HOLDLOCK)
                  WHERE [id_empleado] = @id_empleado
                    AND [fecha] >= @year_start
                    AND [fecha] <  @year_end
                    AND [cancelado_at] IS NULL) < @yearly_limit`,
        {
          id_empleado,
          fecha,
          motivo,
          id_user: access.data.id_user,
          created_at: buildDate(new Date()),
          year_start: start,
          year_end: endExclusive,
          yearly_limit: ECONOMIC_DAYS_PER_YEAR,
        }
      )
    );
    if (insertedRows.length === 0) {
      return { ok: false, message: "Ya no hay días disponibles o la fecha ya está registrada" };
    }

    revalidateEconomicDayViews(id_empleado);
    return { ok: true, data: null };
  } catch {
    return { ok: false, message: "Error al registrar el día económico" };
  }
}

/**
 * Cancela un día económico activo del año en curso (spec 79), pasado o futuro. No borra: llena las
 * columnas de cancelación y el día vuelve al saldo. Los años anteriores son de solo lectura; la
 * condición de año y de estado va en el `UPDATE … WHERE`, así una cancelación repetida afecta 0 filas.
 */
export async function cancelEconomicDay(input: unknown): Promise<ActionResult<null>> {
  try {
    const access = await assertVacationAccess();
    if (!access.ok) return access;

    const parsed = cancelEconomicDaySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { id_economic_day, id_empleado, motivo } = parsed.data;

    const employee = await getEmployeeById(id_empleado);
    if (!employee) return { ok: false, message: "El empleado no existe o no tienes acceso a él" };
    if (!employee.activo) return { ok: false, message: "El empleado está inactivo" };

    const today = addZeroToday(new Date());
    const { start, endExclusive } = getCalendarYearRange(Number(today.slice(0, 4)));
    const cancelledRows = await db.queryParams(
      `UPDATE [CentroPodologico].[RH].[economic_days]
          SET [cancelado_by]       = @id_user,
              [cancelado_at]       = @cancelado_at,
              [motivo_cancelacion] = @motivo
       OUTPUT INSERTED.[id_economic_day]
        WHERE [id_economic_day] = @id_economic_day
          AND [id_empleado] = @id_empleado
          AND [cancelado_at] IS NULL
          AND [fecha] >= @year_start
          AND [fecha] <  @year_end`,
      {
        id_economic_day,
        id_empleado,
        motivo,
        id_user: access.data.id_user,
        cancelado_at: buildDate(new Date()),
        year_start: start,
        year_end: endExclusive,
      }
    );
    if (cancelledRows.length === 0) {
      return { ok: false, message: "El día no existe, ya está cancelado o no es del año en curso" };
    }

    revalidateEconomicDayViews(id_empleado);
    return { ok: true, data: null };
  } catch {
    return { ok: false, message: "Error al cancelar el día económico" };
  }
}
