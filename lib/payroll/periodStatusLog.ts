import "server-only";

import db from "@/database/connection";
import { IPayrollPeriodStatusLogEntry, IPayrollPeriodStatusStamp } from "@/interfaces/payroll_period";

/** Sello con nombres resueltos para el encabezado de Procesar. Null si el periodo nunca se aprobó. */
export async function loadPeriodStatusStamp(idPeriod: number): Promise<IPayrollPeriodStatusStamp | null> {
  const rows = await db.queryParams(
    `SELECT ISNULL(approver.nombre, '') AS approved_by_name,
            CONVERT(varchar(19), p.approved_at, 120) AS approved_at,
            ISNULL(payer.nombre, '')    AS paid_by_name,
            CONVERT(varchar(19), p.paid_at, 120)     AS paid_at
       FROM [CentroPodologico].[payroll].[periods] p
       LEFT JOIN [CentroPodologico].[dbo].[users] approver ON approver.id_user = p.approved_by
       LEFT JOIN [CentroPodologico].[dbo].[users] payer    ON payer.id_user    = p.paid_by
      WHERE p.id_period = @id_period AND p.approved_by IS NOT NULL`,
    { id_period: idPeriod },
  );
  if (rows.length === 0) return null;
  return rows[0] as IPayrollPeriodStatusStamp;
}

/**
 * Historial de cambios de estatus del periodo, con autor y motivo, más reciente primero.
 * `idSucursal` sale siempre de la sesión: un periodo de otra sucursal devuelve un historial vacío,
 * igual que uno inexistente.
 */
export async function loadPeriodStatusLog(idPeriod: number, idSucursal: number): Promise<IPayrollPeriodStatusLogEntry[]> {
  const rows = await db.queryParams(
    `SELECT l.id_period_status_log, l.status_anterior, l.status_nuevo, l.comentario,
            ISNULL(u.nombre, '') AS changed_by_name,
            CONVERT(varchar(19), l.changed_at, 120) AS changed_at
       FROM [CentroPodologico].[payroll].[period_status_log] l
       JOIN [CentroPodologico].[payroll].[periods] p ON p.id_period = l.id_period
       LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = l.changed_by
      WHERE l.id_period = @id_period AND p.id_sucursal = @id_sucursal
      ORDER BY l.changed_at DESC, l.id_period_status_log DESC`,
    { id_period: idPeriod, id_sucursal: idSucursal },
  );
  return rows as IPayrollPeriodStatusLogEntry[];
}
