import "server-only";

/**
 * Fragmentos SQL de los días pendientes de pago (spec 97), compartidos por `calculatePayrollPeriod` y por el
 * aviso "Recalcula" (`pendingDaysRecalculation.ts`), igual que `overtimeRecalculation` reutiliza las reglas de
 * `overtimePay`. Si el SQL y `lib/payroll/pendingDaysPay.ts` llegan a divergir, manda este SQL.
 */

/**
 * `#pending_days`: una fila por captura y tipo de nómina ('O' con tarifa_operativa, 'F' con tarifa_fiscal; una
 * tarifa en 0 no genera fila en ese tipo), de las capturas que pagará `@id_period`, excluyendo los días que
 * **otro** periodo ya pagó en ese tipo (candado `UNIQUE (id_empleado, fecha, tipo_nomina)` del desglose).
 * Espera `@id_period` en alcance.
 */
export const PENDING_DAYS_TEMP_TABLE_SQL = `
       SELECT pdp.[id_empleado], salary.[tipo_nomina], pdp.[fecha], salary.[tarifa_diaria], pdp.[motivo]
         INTO #pending_days
         FROM [CentroPodologico].[payroll].[pending_day_payments] pdp
        CROSS APPLY (VALUES ('O', pdp.[tarifa_operativa]), ('F', pdp.[tarifa_fiscal]))
                    AS salary ([tipo_nomina], [tarifa_diaria])
        WHERE pdp.[id_period] = @id_period
          AND salary.[tarifa_diaria] > 0
          AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_pending_days] pepd
                           WHERE pepd.[id_empleado] = pdp.[id_empleado] AND pepd.[fecha] = pdp.[fecha]
                             AND pepd.[tipo_nomina] = salary.[tipo_nomina]);`;

/**
 * `OUTER APPLY` sobre `#pending_days`, por empleado y tipo de nómina: espera `e` (`[RH].[empleados]`) y
 * `salary.tipo_nomina` en alcance, como las demás `_APPLY_SQL` del cálculo. Dos columnas, con el prefijo
 * `pending_`: `pending_dias` (conteo) y `pending_importe` (suma de `ROUND(tarifa_diaria, 2)` por día).
 */
export const PENDING_DAYS_APPLY_SQL = `
        OUTER APPLY (
          SELECT COUNT(*) AS pending_dias, ISNULL(SUM(ROUND(pd.[tarifa_diaria], 2)), 0) AS pending_importe
            FROM #pending_days pd
           WHERE pd.[id_empleado] = e.[id_empleado] AND pd.[tipo_nomina] = salary.tipo_nomina
        ) AS pending`;

/**
 * Las dos columnas del snapshot que congelan el pago, en este orden: días y su importe, con sus expresiones
 * sobre `PENDING_DAYS_APPLY_SQL`. Mismo patrón que `PUNCTUALITY_BONUS_COLUMNS`.
 */
export const PENDING_DAYS_COLUMNS = [
  { column: "dias_pendientes", expression: "pending.pending_dias" },
  { column: "importe_dias_pendientes", expression: "pending.pending_importe" },
] as const;

/** Lista de columnas para el `INSERT`, lista para pegar: `dias_pendientes, importe_dias_pendientes`. */
export const PENDING_DAYS_COLUMNS_SQL = PENDING_DAYS_COLUMNS.map((entry) => entry.column).join(", ");

/** Lista de expresiones para el `SELECT` del `INSERT`, en el mismo orden que `PENDING_DAYS_COLUMNS_SQL`. */
export const PENDING_DAYS_SELECT_SQL = PENDING_DAYS_COLUMNS.map((entry) => entry.expression).join(", ");
