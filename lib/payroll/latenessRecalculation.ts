import "server-only";

import db from "@/database/connection";
import {
  ABSENCE_CONTROLLED_EMPLOYEE_CONDITION,
  ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS,
} from "@/lib/payroll/eligibleEmployees";
import { addZeroToday } from "@/utils/date_helpper";

/**
 * Aviso "Recalcula" (spec 63): ¿los retardos que se descontarían hoy ya no coinciden con lo que congeló el último cálculo?
 * Solo aplica a periodos en estatus 2 (En cálculo); en cualquier otro estatus responde false.
 * Compara el conjunto de retardos de hoy, con su clasificación (misma detección que `calculatePayrollPeriod`, con el rol
 * y el `status` del usuario evaluados hoy), contra `payroll.period_employee_lateness`:
 *   1. un retardo de hoy que ningún periodo ha descontado para el tipo de un renglón de este periodo;
 *   2. un retardo descontado por este periodo que hoy ya no lo es, o cuya clasificación cambió (justificado, otra
 *      tolerancia o umbral grave, otro horario, checada nueva, o el empleado perdió su usuario podólogo activo);
 *   3. `lateness_settings.updated_at` posterior al `calculated_at` del periodo: cambió la configuración o los escalones,
 *      algo que no cambia el conjunto pero sí el descuento. Aquí sí vale comparar fechas, porque guardar la
 *      configuración siempre es un UPDATE y nunca un DELETE.
 * "Volver a injustificado" es un DELETE y no deja rastro, pero cae en el caso 1, por eso los justificantes se
 * comparan por conjunto y no por `decided_at`.
 * Un solo batch: lee el periodo, arma los retardos de hoy y evalúa tres EXISTS apoyados en los UNIQUE de las tablas.
 */
export async function isLatenessRecalculationNeeded(idPeriod: number): Promise<boolean> {
  const rows = await db.queryParams(
    `DECLARE @id_sucursal int, @id_payment_period int, @fecha_inicio date, @fecha_fin date;
     SELECT @id_sucursal        = id_sucursal,
            @id_payment_period  = id_payment_period,
            @fecha_inicio       = fecha_inicio,
            @fecha_fin          = fecha_fin
       FROM [CentroPodologico].[payroll].[periods]
      WHERE id_period = @id_period AND status = 2;
     IF @id_payment_period IS NULL
     BEGIN
       SELECT 0 AS recalculation_needed;
       RETURN;
     END

     DECLARE @today date = CAST(@today_text AS date);
     ;WITH period_days AS (
       SELECT @fecha_inicio AS fecha
       UNION ALL
       SELECT DATEADD(day, 1, fecha) FROM period_days WHERE fecha < @fecha_fin
     ), todays_lateness AS (
       SELECT e.[id_empleado], d.[fecha],
              CAST(CASE WHEN late.[minutos] >= ls.[minutos_retardo_grave] THEN 'G' ELSE 'A' END AS char(1)) AS clasificacion
         FROM [CentroPodologico].[RH].[empleados] e
         JOIN [CentroPodologico].[payroll].[lateness_settings] ls ON ls.[id_empresa] = e.[id_empresa]
        CROSS JOIN period_days d
         JOIN [CentroPodologico].[RH].[empleado_horarios] h
           ON h.[id_empleado] = e.[id_empleado]
          AND h.[dia_semana] = (DATEDIFF(day, '19000101', d.[fecha]) % 7) + 1
        CROSS APPLY (SELECT MIN(a.[fecha_hora]) AS llegada
                       FROM [CentroPodologico].[RH].[asistencias] a
                      WHERE a.[id_empleado] = e.[id_empleado]
                        AND a.[tipo] = 'entrada'
                        AND a.[fecha_hora] >= d.[fecha]
                        AND a.[fecha_hora] <  DATEADD(day, 1, d.[fecha])) first_entry
        CROSS APPLY (SELECT DATEDIFF(second, h.[hora_entrada_1],
                                     CAST(CONVERT(varchar(8), first_entry.[llegada], 108) AS time(0))) / 60 AS minutos) late
        WHERE ${ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS}
          AND ${ABSENCE_CONTROLLED_EMPLOYEE_CONDITION}
          AND d.[fecha] >= e.[fecha_ingreso]
          AND d.[fecha] <= @today
          AND first_entry.[llegada] IS NOT NULL
          AND late.[minutos] >= ls.[tolerancia_minutos]
          AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[lateness_justifications] lj
                           WHERE lj.[id_empleado] = e.[id_empleado] AND lj.[fecha] = d.[fecha])
          AND (late.[minutos] >= ls.[minutos_retardo_grave]
               OR EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[lateness_tiers] lt
                           WHERE lt.[id_empresa] = e.[id_empresa] AND lt.[id_payment_period] = @id_payment_period))
     )
     SELECT CASE WHEN EXISTS (
              -- 1. Retardo de hoy que ningún periodo descontó para el tipo de un renglón de este periodo.
              SELECT 1
                FROM todays_lateness tl
                JOIN [CentroPodologico].[payroll].[period_employees] pe
                  ON pe.[id_period] = @id_period AND pe.[id_empleado] = tl.[id_empleado]
               WHERE NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_lateness] ple
                                  WHERE ple.[id_empleado] = tl.[id_empleado] AND ple.[fecha] = tl.[fecha]
                                    AND ple.[tipo_nomina] = pe.[tipo_nomina])
            ) OR EXISTS (
              -- 2. Retardo descontado por este periodo que hoy ya no lo es, o que cambió de clasificación.
              SELECT 1
                FROM [CentroPodologico].[payroll].[period_employees] pe
                JOIN [CentroPodologico].[payroll].[period_employee_lateness] ple
                  ON ple.[id_period_employee] = pe.[id_period_employee]
               WHERE pe.[id_period] = @id_period
                 AND NOT EXISTS (SELECT 1 FROM todays_lateness tl
                                  WHERE tl.[id_empleado] = ple.[id_empleado] AND tl.[fecha] = ple.[fecha]
                                    AND tl.[clasificacion] = ple.[clasificacion])
            ) OR EXISTS (
              -- 3. Configuración o escalones editados después del último cálculo.
              SELECT 1
                FROM [CentroPodologico].[payroll].[period_employees] pe
                JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = pe.[id_empleado]
                JOIN [CentroPodologico].[payroll].[lateness_settings] ls ON ls.[id_empresa] = e.[id_empresa]
               WHERE pe.[id_period] = @id_period
                 AND ls.[updated_at] > (SELECT MIN(calculated_at)
                                          FROM [CentroPodologico].[payroll].[period_employees]
                                         WHERE id_period = @id_period)
            ) THEN 1 ELSE 0 END AS recalculation_needed
     OPTION (MAXRECURSION 400);`,
    { id_period: idPeriod, today_text: addZeroToday(new Date()) },
  );
  return Number(rows[0]?.recalculation_needed ?? 0) === 1;
}
