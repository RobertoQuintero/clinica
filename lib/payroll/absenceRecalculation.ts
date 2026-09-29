import "server-only";

import db from "@/database/connection";
import {
  ABSENCE_CONTROLLED_EMPLOYEE_CONDITION,
  ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS,
} from "@/lib/payroll/eligibleEmployees";
import { addZeroToday } from "@/utils/date_helpper";

/**
 * Aviso "Recalcula" (spec 62): ¿las faltas que se descontarían hoy ya no coinciden con lo que congeló el último cálculo?
 * Solo aplica a periodos en estatus 2 (En cálculo); en cualquier otro estatus responde false.
 * Compara el conjunto de faltas de hoy (misma detección que `calculatePayrollPeriod`, con el rol y el `status` del
 * usuario evaluados hoy) contra `payroll.period_employee_absences`:
 *   1. una falta de hoy que ningún periodo ha descontado para el tipo de un renglón de este periodo;
 *   2. una falta descontada por este periodo que hoy ya no es falta (justificada, con checada nueva, con otro
 *      horario, o el empleado perdió su usuario podólogo activo).
 * "Volver a injustificada" es un DELETE y no deja rastro, pero cae en el caso 1, por eso se compara el conjunto
 * completo y no `decided_at` contra `calculated_at`.
 * Un solo batch: lee el periodo, arma las faltas de hoy y evalúa dos EXISTS apoyados en los UNIQUE de las tablas.
 */
export async function isAbsenceRecalculationNeeded(idPeriod: number): Promise<boolean> {
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
     ), todays_absences AS (
       SELECT e.[id_empleado], d.[fecha]
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
     )
     SELECT CASE WHEN EXISTS (
              -- 1. Falta de hoy que ningún periodo descontó para el tipo de un renglón de este periodo.
              SELECT 1
                FROM todays_absences ta
                JOIN [CentroPodologico].[payroll].[period_employees] pe
                  ON pe.[id_period] = @id_period AND pe.[id_empleado] = ta.[id_empleado]
               WHERE NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_absences] pea
                                  WHERE pea.[id_empleado] = ta.[id_empleado] AND pea.[fecha] = ta.[fecha]
                                    AND pea.[tipo_nomina] = pe.[tipo_nomina])
            ) OR EXISTS (
              -- 2. Falta descontada por este periodo que hoy ya no es falta.
              SELECT 1
                FROM [CentroPodologico].[payroll].[period_employees] pe
                JOIN [CentroPodologico].[payroll].[period_employee_absences] pea
                  ON pea.[id_period_employee] = pe.[id_period_employee]
               WHERE pe.[id_period] = @id_period
                 AND NOT EXISTS (SELECT 1 FROM todays_absences ta
                                  WHERE ta.[id_empleado] = pea.[id_empleado] AND ta.[fecha] = pea.[fecha])
            ) THEN 1 ELSE 0 END AS recalculation_needed
     OPTION (MAXRECURSION 400);`,
    { id_period: idPeriod, today_text: addZeroToday(new Date()) },
  );
  return Number(rows[0]?.recalculation_needed ?? 0) === 1;
}
