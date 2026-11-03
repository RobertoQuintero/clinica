import "server-only";

import db from "@/database/connection";

/**
 * Aviso "Recalcula" (spec 97): ¿los días pendientes de pago ya no coinciden con lo que congeló el último
 * cálculo? Solo aplica a periodos en estatus 2 (En cálculo); en cualquier otro estatus responde false.
 *   1. una captura de este periodo, con tarifa > 0 y con fila de `period_employees` en ese tipo, que ningún
 *      tipo pagó todavía (no está en `period_employee_pending_days`);
 *   2. una fila del desglose de este periodo cuya captura ya no existe (se borró después de pagada);
 *   3. una fila del desglose de este periodo cuya tarifa congelada difiere de la tarifa capturada hoy
 *      (la captura se borró y se volvió a capturar con otro valor).
 * Un solo SELECT con EXISTS, igual que `overtimeRecalculation`.
 */
export async function isPendingDaysRecalculationNeeded(idPeriod: number): Promise<boolean> {
  const rows = await db.queryParams(
    `SELECT CASE WHEN EXISTS (
              -- 1. Captura de este periodo que ningún tipo pagó, para un tipo donde el empleado sí tiene fila.
              SELECT 1
                FROM [CentroPodologico].[payroll].[pending_day_payments] pdp
               CROSS APPLY (VALUES ('O', pdp.[tarifa_operativa]), ('F', pdp.[tarifa_fiscal]))
                           AS salary ([tipo_nomina], [tarifa_diaria])
                JOIN [CentroPodologico].[payroll].[period_employees] pe
                  ON pe.[id_period] = pdp.[id_period] AND pe.[id_empleado] = pdp.[id_empleado]
                 AND pe.[tipo_nomina] = salary.[tipo_nomina]
               WHERE pdp.[id_period] = @id_period
                 AND salary.[tarifa_diaria] > 0
                 AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_pending_days] pepd
                                  WHERE pepd.[id_empleado] = pdp.[id_empleado] AND pepd.[fecha] = pdp.[fecha]
                                    AND pepd.[tipo_nomina] = salary.[tipo_nomina])
            ) OR EXISTS (
              -- 2 y 3. Fila del desglose de este periodo sin captura vigente, o con tarifa distinta a la capturada.
              SELECT 1
                FROM [CentroPodologico].[payroll].[period_employees] pe
                JOIN [CentroPodologico].[payroll].[period_employee_pending_days] pepd
                  ON pepd.[id_period_employee] = pe.[id_period_employee]
                LEFT JOIN [CentroPodologico].[payroll].[pending_day_payments] pdp
                  ON pdp.[id_empleado] = pepd.[id_empleado] AND pdp.[fecha] = pepd.[fecha]
               WHERE pe.[id_period] = p.[id_period]
                 AND (pdp.[id_pending_day_payment] IS NULL
                      OR pepd.[tarifa_diaria] <> CASE pepd.[tipo_nomina] WHEN 'O' THEN pdp.[tarifa_operativa] ELSE pdp.[tarifa_fiscal] END)
            ) THEN 1 ELSE 0 END AS recalculation_needed
       FROM [CentroPodologico].[payroll].[periods] p
      WHERE p.[id_period] = @id_period AND p.[status] = 2`,
    { id_period: idPeriod },
  );
  return Number(rows[0]?.recalculation_needed ?? 0) === 1;
}
