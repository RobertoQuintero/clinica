"use server";

import db from "@/database/connection";
import { getEmployeeById } from "@/app/dashboard/empleados/actions";
import {
  IVacationEntitlement,
  IVacationEntitlementView,
  IVacationLogEntry,
} from "@/interfaces/vacation";
import { assertVacationAccess } from "@/lib/vacations/vacationAccess";
import { calculateVacationEndDate } from "@/lib/vacations/vacationDates";
import { getDaysToPay, getVacationStatus } from "@/lib/vacations/vacationStatus";
import { addZeroToday, buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import { scheduleVacationBlockSchema } from "./schemas";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function revalidateVacationViews(id_empleado: number) {
  revalidatePath(`/dashboard/empleados/${id_empleado}`, "layout");
  revalidatePath("/dashboard/empleados");
}

/** Años de derecho del empleado (más reciente primero) con estatus derivado y bitácora. */
export async function getEmployeeVacations(
  id_empleado: number
): Promise<IVacationEntitlementView[]> {
  // getEmployeeById valida empresa y sucursales del usuario; sin acceso no se expone nada.
  const employee = await getEmployeeById(id_empleado);
  if (!employee) return [];

  const entitlements = (await db.queryParams(
    `SELECT [id_vacation_entitlement],
            [id_empleado],
            [anio_servicio],
            CONVERT(varchar(10), [fecha_aniversario],           120) AS fecha_aniversario,
            CONVERT(varchar(10), [fecha_limite_solicitud],      120) AS fecha_limite_solicitud,
            CONVERT(varchar(10), [fecha_siguiente_aniversario], 120) AS fecha_siguiente_aniversario,
            [dias_derecho],
            CONVERT(varchar(10), [fecha_inicio], 120) AS fecha_inicio,
            CONVERT(varchar(10), [fecha_fin],    120) AS fecha_fin,
            [dias_tomados],
            CONVERT(varchar(19), [solicitado_at], 120) AS solicitado_at,
            CONVERT(varchar(10), [fecha_pago],   120) AS fecha_pago,
            [dias_pagados],
            [comentario_pago]
       FROM [CentroPodologico].[RH].[vacation_entitlements]
      WHERE [id_empleado] = @id_empleado
      ORDER BY [anio_servicio] DESC`,
    { id_empleado }
  )) as IVacationEntitlement[];

  if (entitlements.length === 0) return [];

  const logRows = (await db.queryParams(
    `SELECT l.[id_vacation_entitlement],
            l.[id_log],
            l.[accion],
            CONVERT(varchar(10), l.[fecha_inicio_anterior], 120) AS fecha_inicio_anterior,
            CONVERT(varchar(10), l.[fecha_fin_anterior],    120) AS fecha_fin_anterior,
            l.[dias_tomados_anterior],
            CONVERT(varchar(10), l.[fecha_inicio_nueva],    120) AS fecha_inicio_nueva,
            CONVERT(varchar(10), l.[fecha_fin_nueva],       120) AS fecha_fin_nueva,
            l.[dias_tomados_nueva],
            CONVERT(varchar(10), l.[fecha_pago],            120) AS fecha_pago,
            l.[dias_pagados],
            l.[motivo],
            u.[nombre] AS created_by_name,
            CONVERT(varchar(19), l.[created_at], 120) AS created_at
       FROM [CentroPodologico].[RH].[vacation_entitlement_log] l
       JOIN [CentroPodologico].[RH].[vacation_entitlements] v
         ON v.[id_vacation_entitlement] = l.[id_vacation_entitlement]
       LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.[id_user] = l.[created_by]
      WHERE v.[id_empleado] = @id_empleado
      ORDER BY l.[created_at] DESC, l.[id_log] DESC`,
    { id_empleado }
  )) as (IVacationLogEntry & { id_vacation_entitlement: number })[];

  const logByEntitlement = new Map<number, IVacationLogEntry[]>();
  for (const { id_vacation_entitlement, ...entry } of logRows) {
    const entries = logByEntitlement.get(id_vacation_entitlement) ?? [];
    entries.push(entry);
    logByEntitlement.set(id_vacation_entitlement, entries);
  }

  const today = addZeroToday(new Date());
  return entitlements.map((entitlement) => ({
    ...entitlement,
    status: getVacationStatus(entitlement, today),
    dias_por_pagar: getDaysToPay(entitlement, today),
    log: logByEntitlement.get(entitlement.id_vacation_entitlement) ?? [],
  }));
}

/** Días ISO (1 = lunes … 7 = domingo) con fila en el horario del empleado. Vacío = sin horario. */
export async function getEmployeeWorkingWeekdays(id_empleado: number): Promise<number[]> {
  const employee = await getEmployeeById(id_empleado);
  if (!employee) return [];

  const rows = (await db.queryParams(
    `SELECT [dia_semana]
       FROM [CentroPodologico].[RH].[empleado_horarios]
      WHERE [id_empleado] = @id_empleado
      ORDER BY [dia_semana]`,
    { id_empleado }
  )) as { dia_semana: number }[];

  return rows.map((row) => row.dia_semana);
}

/**
 * Captura el bloque único de vacaciones de un año de derecho (spec 76). `fecha_fin` se recalcula
 * aquí con el horario actual; la condición de estado se repite en el `UPDATE … WHERE` para que una
 * captura concurrente afecte 0 filas y devuelva `{ ok: false }`.
 */
export async function scheduleVacationBlock(input: unknown): Promise<ActionResult<null>> {
  try {
    const access = await assertVacationAccess();
    if (!access.ok) return access;

    const parsed = scheduleVacationBlockSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { id_empleado, id_vacation_entitlement, fecha_inicio, dias_tomados } = parsed.data;

    const employee = await getEmployeeById(id_empleado);
    if (!employee) return { ok: false, message: "El empleado no existe o no tienes acceso a él" };

    const [entitlement] = (await db.queryParams(
      `SELECT v.[dias_derecho],
              CONVERT(varchar(10), v.[fecha_aniversario],           120) AS fecha_aniversario,
              CONVERT(varchar(10), v.[fecha_limite_solicitud],      120) AS fecha_limite_solicitud,
              CONVERT(varchar(10), v.[fecha_siguiente_aniversario], 120) AS fecha_siguiente_aniversario,
              CASE WHEN v.[anio_servicio] = (SELECT MAX(x.[anio_servicio])
                                               FROM [CentroPodologico].[RH].[vacation_entitlements] x
                                              WHERE x.[id_empleado] = v.[id_empleado])
                   THEN 1 ELSE 0 END AS is_current_year
         FROM [CentroPodologico].[RH].[vacation_entitlements] v
        WHERE v.[id_vacation_entitlement] = @id_vacation_entitlement
          AND v.[id_empleado] = @id_empleado`,
      { id_vacation_entitlement, id_empleado }
    )) as {
      dias_derecho: number;
      fecha_aniversario: string;
      fecha_limite_solicitud: string;
      fecha_siguiente_aniversario: string;
      is_current_year: number;
    }[];
    if (!entitlement) return { ok: false, message: "El año de vacaciones no existe" };
    if (!entitlement.is_current_year) {
      return { ok: false, message: "Solo se puede capturar el año vigente" };
    }

    const today = addZeroToday(new Date());
    if (today > entitlement.fecha_limite_solicitud) {
      return { ok: false, message: "La fecha límite para solicitar este año ya venció" };
    }
    if (dias_tomados > entitlement.dias_derecho) {
      return { ok: false, message: `El empleado solo tiene ${entitlement.dias_derecho} días de derecho` };
    }
    if (fecha_inicio < entitlement.fecha_aniversario) {
      return { ok: false, message: "El bloque no puede empezar antes del aniversario" };
    }

    const workingWeekdays = await getEmployeeWorkingWeekdays(id_empleado);
    if (workingWeekdays.length === 0) {
      return { ok: false, message: "Sin horario definido: captura el horario del empleado primero" };
    }

    const fecha_fin = calculateVacationEndDate(fecha_inicio, dias_tomados, workingWeekdays);
    if (!fecha_fin) return { ok: false, message: "No se pudo calcular la fecha de fin" };
    if (fecha_fin >= entitlement.fecha_siguiente_aniversario) {
      return {
        ok: false,
        message: "El bloque terminaría en el siguiente año de servicio; las vacaciones no son acumulativas",
      };
    }

    const requestedAt = buildDate(new Date());
    const wasSaved = await db.transaction(async (tx) => {
      const updatedRows = await tx.queryParams(
        `UPDATE [CentroPodologico].[RH].[vacation_entitlements]
            SET [fecha_inicio]   = @fecha_inicio,
                [fecha_fin]      = @fecha_fin,
                [dias_tomados]   = @dias_tomados,
                [solicitado_by]  = @id_user,
                [solicitado_at]  = @solicitado_at
         OUTPUT INSERTED.[id_vacation_entitlement]
          WHERE [id_vacation_entitlement] = @id_vacation_entitlement
            AND [id_empleado] = @id_empleado
            AND [fecha_inicio] IS NULL
            AND [fecha_pago] IS NULL
            AND [fecha_limite_solicitud] >= @today`,
        {
          id_vacation_entitlement,
          id_empleado,
          fecha_inicio,
          fecha_fin,
          dias_tomados,
          id_user: access.data.id_user,
          solicitado_at: requestedAt,
          today,
        }
      );
      if (updatedRows.length === 0) return false;

      await tx.queryParams(
        `INSERT INTO [CentroPodologico].[RH].[vacation_entitlement_log]
           ([id_vacation_entitlement], [accion], [fecha_inicio_nueva], [fecha_fin_nueva],
            [dias_tomados_nueva], [created_by], [created_at])
         VALUES
           (@id_vacation_entitlement, 'C', @fecha_inicio, @fecha_fin,
            @dias_tomados, @id_user, @created_at)`,
        {
          id_vacation_entitlement,
          fecha_inicio,
          fecha_fin,
          dias_tomados,
          id_user: access.data.id_user,
          created_at: requestedAt,
        }
      );
      return true;
    });
    if (!wasSaved) {
      return { ok: false, message: "Este año ya tiene un bloque capturado o ya no admite captura" };
    }

    revalidateVacationViews(id_empleado);
    return { ok: true, data: null };
  } catch {
    return { ok: false, message: "Error al capturar las vacaciones" };
  }
}
