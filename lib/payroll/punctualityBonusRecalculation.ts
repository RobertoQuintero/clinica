import "server-only";

import db from "@/database/connection";
import {
  ABSENCE_CONTROLLED_EMPLOYEE_CONDITION,
  ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS,
} from "@/lib/payroll/eligibleEmployees";
import { PUNCTUALITY_BONUS_APPLY_SQL, PUNCTUALITY_BONUS_COLUMNS } from "@/lib/payroll/punctualityBonusSql";
import { addZeroToday } from "@/utils/date_helpper";

/**
 * Condición "el valor de hoy es distinto del snapshot" para las cinco columnas del bono, armada con las mismas
 * expresiones que usa el cálculo (`PUNCTUALITY_BONUS_COLUMNS`). El resultado es texto; lo demás se compara como número
 * con NULL tratado como -1 (el máximo es NULL cuando el resultado es 'N').
 */
const SNAPSHOT_DIFFERS_CONDITION = PUNCTUALITY_BONUS_COLUMNS.map(({ column, expression }) =>
  column === "bono_puntualidad_resultado"
    ? `pe.[${column}] <> ${expression}`
    : `ISNULL(CAST(pe.[${column}] AS decimal(14,2)), -1) <> ISNULL(CAST(${expression} AS decimal(14,2)), -1)`,
).join("\n                    OR ");

/**
 * Aviso "Recalcula" del bono de puntualidad (spec 64): ¿el bono que saldría hoy ya no coincide con lo que congeló el
 * último cálculo? Solo aplica a periodos en estatus 2 (En cálculo); en cualquier otro estatus responde false.
 * Responde true cuando pasa cualquiera de estas dos cosas:
 *   1. el resultado de hoy (retardos, faltas, máximo, resultado o importe) de algún renglón 'O' es distinto del snapshot.
 *      Ve justificantes nuevos o borrados, checadas nuevas, faltas nuevas, cambios de tolerancia, de horario o de
 *      usuario podólogo, y cambios de monto o máximo que sí alteran el resultado;
 *   2. `punctuality_bonus_settings.updated_at` de la frecuencia del periodo es posterior al `calculated_at`. Ve los
 *      cambios de configuración que no alteran el resultado (por ejemplo, subir el monto de quien ya lo perdió).
 *      Guardar la configuración siempre es un UPDATE o un INSERT, por eso aquí sí vale comparar fechas.
 *
 * Un solo batch: arma `#lateness` y `#absences` con las mismas reglas que `calculatePayrollPeriod` (todos los retardos
 * injustificados hasta hoy inclusive, las faltas hasta ayer, sin el candado de descuento) y evalúa el bono con los
 * fragmentos de `punctualityBonusSql.ts`, los mismos del cálculo.
 */
export async function isPunctualityBonusRecalculationNeeded(idPeriod: number): Promise<boolean> {
  const rows = await db.queryParams(
    `SET NOCOUNT ON;
     DECLARE @id_sucursal int, @id_payment_period smallint, @fecha_inicio date, @fecha_fin date;
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
     )
     SELECT e.[id_empleado], d.[fecha]
       INTO #absences
       FROM [CentroPodologico].[RH].[empleados] e
      CROSS JOIN period_days d
      WHERE ${ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS}
        AND ${ABSENCE_CONTROLLED_EMPLOYEE_CONDITION}
        AND d.[fecha] >= e.[fecha_ingreso]
        AND d.[fecha] <  @today
        AND EXISTS (SELECT 1 FROM [CentroPodologico].[RH].[empleado_horarios] h
                     WHERE h.[id_empleado] = e.[id_empleado]
                       AND h.[dia_semana] = (DATEDIFF(day, '19000101', d.[fecha]) % 7) + 1)
        AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[RH].[asistencias] a
                         WHERE a.[id_empleado] = e.[id_empleado]
                           AND a.[fecha_hora] >= d.[fecha]
                           AND a.[fecha_hora] <  DATEADD(day, 1, d.[fecha]))
        AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[absence_justifications] aj
                         WHERE aj.[id_empleado] = e.[id_empleado] AND aj.[fecha] = d.[fecha])
     OPTION (MAXRECURSION 400);

     ;WITH period_days AS (
       SELECT @fecha_inicio AS fecha
       UNION ALL
       SELECT DATEADD(day, 1, fecha) FROM period_days WHERE fecha < @fecha_fin
     )
     SELECT e.[id_empleado], d.[fecha]
       INTO #lateness
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
        AND late.[minutos] > ls.[tolerancia_minutos]
        AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[lateness_justifications] lj
                         WHERE lj.[id_empleado] = e.[id_empleado] AND lj.[fecha] = d.[fecha])
     OPTION (MAXRECURSION 400);

     SELECT CASE WHEN EXISTS (
              -- 1. El bono de hoy de algún renglón operativo es distinto del snapshot.
              SELECT 1
                FROM [CentroPodologico].[payroll].[period_employees] pe
                JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = pe.[id_empleado]
                LEFT JOIN [CentroPodologico].[payroll].[lateness_settings] lateness_settings
                       ON lateness_settings.[id_empresa] = e.[id_empresa]
               CROSS APPLY (SELECT CAST('O' AS char(1)) AS tipo_nomina) AS salary${PUNCTUALITY_BONUS_APPLY_SQL}
               WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'O'
                 AND (${SNAPSHOT_DIFFERS_CONDITION})
            ) OR EXISTS (
              -- 2. Configuración del bono de la frecuencia del periodo editada después del último cálculo.
              SELECT 1
                FROM [CentroPodologico].[payroll].[period_employees] pe
                JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = pe.[id_empleado]
                JOIN [CentroPodologico].[payroll].[punctuality_bonus_settings] bs
                  ON bs.[id_empresa] = e.[id_empresa] AND bs.[id_payment_period] = @id_payment_period
               WHERE pe.[id_period] = @id_period
                 AND bs.[updated_at] > (SELECT MIN(calculated_at)
                                          FROM [CentroPodologico].[payroll].[period_employees]
                                         WHERE id_period = @id_period)
            ) THEN 1 ELSE 0 END AS recalculation_needed;`,
    { id_period: idPeriod, today_text: addZeroToday(new Date()) },
  );
  return Number(rows[0]?.recalculation_needed ?? 0) === 1;
}
