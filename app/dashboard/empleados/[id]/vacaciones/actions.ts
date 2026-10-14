"use server";

import db from "@/database/connection";
import { getEmployeeById } from "@/app/dashboard/empleados/actions";
import {
  IVacationEntitlement,
  IVacationEntitlementView,
  IVacationLogEntry,
} from "@/interfaces/vacation";
import { getDaysToPay, getVacationStatus } from "@/lib/vacations/vacationStatus";
import { addZeroToday } from "@/utils/date_helpper";

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
