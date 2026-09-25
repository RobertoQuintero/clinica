import "server-only";

import db from "@/database/connection";

/**
 * Aviso "Recalcula" (spec 61): ¿las autorizaciones de horas extra ya no coinciden con lo que congeló el último cálculo?
 * Solo aplica a periodos en estatus 2 (En cálculo); en cualquier otro estatus responde false.
 * Compara contra el desglose `payroll.period_employee_overtime`, solo para los empleados con fila 'O' en el snapshot:
 *   1. un día autorizado del rango que no está en el desglose de ningún periodo;
 *   2. un día del desglose de este periodo que ya no está autorizado (rechazado o vuelto a pendiente);
 *   3. un día del desglose con `horas_autorizadas` distintas a la autorización actual;
 *   4. un `limite_horas_dobles_periodo` vigente distinto de `limite_horas_dobles_aplicado`.
 * Un solo SELECT con EXISTS, acotado al periodo y apoyado en los UNIQUE (id_empleado, fecha) de ambas tablas.
 */
export async function isOvertimeRecalculationNeeded(idPeriod: number): Promise<boolean> {
  const rows = await db.queryParams(
    `SELECT CASE WHEN EXISTS (
              -- 1. Día autorizado del rango que ningún periodo ha pagado (solo si la empresa tiene configuración).
              SELECT 1
                FROM [CentroPodologico].[payroll].[period_employees] pe
                JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = pe.[id_empleado]
                JOIN [CentroPodologico].[payroll].[overtime_settings] s ON s.[id_empresa] = e.[id_empresa]
                JOIN [CentroPodologico].[payroll].[overtime_authorizations] a ON a.[id_empleado] = pe.[id_empleado]
               WHERE pe.[id_period] = p.[id_period] AND pe.[tipo_nomina] = 'O'
                 AND a.[estado] = 'A'
                 AND a.[fecha] >= p.[fecha_inicio] AND a.[fecha] <= p.[fecha_fin]
                 AND a.[fecha] >= e.[fecha_ingreso]
                 AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_overtime] po
                                  WHERE po.[id_empleado] = a.[id_empleado] AND po.[fecha] = a.[fecha])
            ) OR EXISTS (
              -- 2 y 3. Día del desglose sin autorización vigente, o con horas distintas.
              SELECT 1
                FROM [CentroPodologico].[payroll].[period_employees] pe
                JOIN [CentroPodologico].[payroll].[period_employee_overtime] po
                  ON po.[id_period_employee] = pe.[id_period_employee]
                LEFT JOIN [CentroPodologico].[payroll].[overtime_authorizations] a
                  ON a.[id_empleado] = po.[id_empleado] AND a.[fecha] = po.[fecha] AND a.[estado] = 'A'
               WHERE pe.[id_period] = p.[id_period] AND pe.[tipo_nomina] = 'O'
                 AND (a.[id_overtime_authorization] IS NULL OR a.[horas_autorizadas] <> po.[horas_autorizadas])
            ) OR EXISTS (
              -- 4. El límite de dobles cambió desde el cálculo.
              SELECT 1
                FROM [CentroPodologico].[payroll].[period_employees] pe
                JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = pe.[id_empleado]
                LEFT JOIN [CentroPodologico].[payroll].[overtime_settings] s ON s.[id_empresa] = e.[id_empresa]
               WHERE pe.[id_period] = p.[id_period] AND pe.[tipo_nomina] = 'O'
                 AND ISNULL(s.[limite_horas_dobles_periodo], 0) <> pe.[limite_horas_dobles_aplicado]
            ) THEN 1 ELSE 0 END AS recalculation_needed
       FROM [CentroPodologico].[payroll].[periods] p
      WHERE p.[id_period] = @id_period AND p.[status] = 2`,
    { id_period: idPeriod },
  );
  return Number(rows[0]?.recalculation_needed ?? 0) === 1;
}
