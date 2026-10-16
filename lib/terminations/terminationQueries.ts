import "server-only";

import db from "@/database/connection";
import type { IEmployeeTermination } from "@/interfaces/employee_termination";

/**
 * Bajas del empleado (vigente y anuladas), de la más reciente a la más antigua.
 * No valida acceso: quien la llame debe haber comprobado antes empresa y sucursal del usuario.
 */
export async function fetchEmployeeTerminations(
  id_empleado: number
): Promise<IEmployeeTermination[]> {
  return (await db.queryParams(
    `SELECT t.[id_employee_termination],
            t.[id_empleado],
            CONVERT(varchar(10), t.[fecha_baja], 120)    AS fecha_baja,
            t.[clave_causa],
            c.[nombre]                                   AS nombre_causa,
            t.[tipo_terminacion],
            t.[observaciones],
            t.[registrado_by],
            ISNULL(registrar.[nombre], '')               AS registrado_by_nombre,
            CONVERT(varchar(19), t.[registrado_at], 120) AS registrado_at,
            t.[anulado_by],
            canceller.[nombre]                           AS anulado_by_nombre,
            CONVERT(varchar(19), t.[anulado_at], 120)    AS anulado_at,
            t.[motivo_anulacion]
       FROM [CentroPodologico].[RH].[employee_terminations] t
       JOIN [CentroPodologico].[RH].[cat_causas_baja] c ON c.[clave] = t.[clave_causa]
       LEFT JOIN [CentroPodologico].[dbo].[users] registrar ON registrar.[id_user] = t.[registrado_by]
       LEFT JOIN [CentroPodologico].[dbo].[users] canceller ON canceller.[id_user] = t.[anulado_by]
      WHERE t.[id_empleado] = @id_empleado
      ORDER BY t.[fecha_baja] DESC, t.[id_employee_termination] DESC`,
    { id_empleado }
  )) as IEmployeeTermination[];
}
