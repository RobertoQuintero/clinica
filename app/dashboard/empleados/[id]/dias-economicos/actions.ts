"use server";

import db from "@/database/connection";
import { getEmployeeById } from "@/app/dashboard/empleados/actions";
import { IEconomicDay } from "@/interfaces/economic_day";

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
