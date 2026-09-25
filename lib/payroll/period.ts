import "server-only";

import db from "@/database/connection";
import { IPayrollPeriodRow } from "@/interfaces/payroll_period";
import { PERIOD_ROW_SELECT } from "@/lib/payroll/access";
import { addZeroToday } from "@/utils/date_helpper";

const PERIOD_FROM = `
  FROM [CentroPodologico].[payroll].[periods] p
  JOIN [CentroPodologico].[RH].[payment_periods] pp ON pp.id_payment_period = p.id_payment_period`;

/**
 * Resuelve el periodo de la pantalla: el pedido (si es de la sucursal), o el vigente,
 * o el de inicio más reciente. Compartido por Procesar y Horas extra.
 */
export async function resolvePeriod(idSucursal: number, idPeriod: number | null): Promise<IPayrollPeriodRow | null> {
  if (idPeriod !== null) {
    // Un periodo de otra sucursal no se distingue de uno inexistente.
    const rows = await db.queryParams(
      `SELECT ${PERIOD_ROW_SELECT} ${PERIOD_FROM}
        WHERE p.id_period = @id_period AND p.id_sucursal = @id_sucursal`,
      { id_period: idPeriod, id_sucursal: idSucursal },
    );
    return (rows[0] as IPayrollPeriodRow | undefined) ?? null;
  }

  // Sin periodo pedido: el activo en curso; si no hay, el de inicio más reciente.
  const rows = await db.queryParams(
    `SELECT TOP 1 ${PERIOD_ROW_SELECT} ${PERIOD_FROM}
      WHERE p.id_sucursal = @id_sucursal
      ORDER BY CASE WHEN CAST(@today AS date) BETWEEN p.fecha_inicio AND p.fecha_fin THEN 0 ELSE 1 END,
               p.fecha_inicio DESC, p.id_period DESC`,
    { id_sucursal: idSucursal, today: addZeroToday(new Date()) },
  );
  return (rows[0] as IPayrollPeriodRow | undefined) ?? null;
}
