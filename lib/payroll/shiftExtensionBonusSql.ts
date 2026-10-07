import "server-only";

import {
  SHIFT_EXTENSION_HOURS_PER_DAY,
  SHIFT_EXTENSION_PAY_MULTIPLIER,
} from "@/lib/payroll/constants";
import {
  ABSENCE_CONTROLLED_EMPLOYEE_CONDITION,
  ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS,
} from "@/lib/payroll/eligibleEmployees";

/**
 * Fragmentos SQL del bono por extensión de jornada (spec 68), compartidos por `calculatePayrollPeriod` y por el aviso
 * "Recalcula" (`shiftExtensionBonusRecalculation.ts`). lib/payroll/shiftExtensionBonus.ts los espeja para la pantalla y,
 * si divergen, manda este SQL.
 *
 * `SHIFT_EXTENSION_WORKED_DAYS_SQL` es una sentencia que llena `#shift_extension_days`; necesita los parámetros
 * @id_sucursal, @id_payment_period, @fecha_inicio y @fecha_fin del periodo y se pega en el batch antes del SELECT que
 * usa `SHIFT_EXTENSION_BONUS_APPLY_SQL`. Este último se pega en el FROM de un SELECT sobre `[RH].[empleados] e` que ya
 * tiene en alcance `salary (tipo_nomina, salario_diario)`: el bono solo existe en el renglón 'O'.
 *
 * Los alias son propios (`extension_*`) para convivir en el mismo SELECT con los `bonus_*` de puntualidad y los
 * `attendance_*` de asistencia. No depende de la configuración de ninguna empresa: la hora y el multiplicador son
 * constantes. Hoy no hace falta: los días futuros no tienen checada y nunca se usa GETDATE().
 */

/**
 * Días trabajados: un día cuenta si el podólogo con asignación activa tiene horario ese día de la semana ISO, no es
 * anterior a su fecha de ingreso y tiene al menos una checada, de cualquier tipo (una incompleta cuenta). Un día de
 * descanso con checada no cuenta, ni un día con horario sin checada aunque tenga justificante.
 */
export const SHIFT_EXTENSION_WORKED_DAYS_SQL = `
       -- Spec 68: días con horario y al menos una checada de los podólogos con el bono asignado.
       ;WITH extension_period_days AS (
         SELECT @fecha_inicio AS fecha
         UNION ALL
         SELECT DATEADD(day, 1, fecha) FROM extension_period_days WHERE fecha < @fecha_fin
       )
       SELECT e.[id_empleado], d.[fecha]
         INTO #shift_extension_days
         FROM [CentroPodologico].[RH].[empleados] e
        CROSS JOIN extension_period_days d
        WHERE ${ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS}
          AND ${ABSENCE_CONTROLLED_EMPLOYEE_CONDITION}
          AND EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[shift_extension_assignments] xa
                       WHERE xa.[id_empleado] = e.[id_empleado] AND xa.[activo] = 1)
          AND d.[fecha] >= e.[fecha_ingreso]
          AND EXISTS (SELECT 1 FROM [CentroPodologico].[RH].[empleado_horarios] h
                       WHERE h.[id_empleado] = e.[id_empleado]
                         AND h.[dia_semana] = (DATEDIFF(day, '19000101', d.[fecha]) % 7) + 1)
          AND EXISTS (SELECT 1 FROM [CentroPodologico].[RH].[asistencias] a
                       WHERE a.[id_empleado] = e.[id_empleado]
                         AND a.[fecha_hora] >= d.[fecha]
                         AND a.[fecha_hora] <  DATEADD(day, 1, d.[fecha]))
       OPTION (MAXRECURSION 400);`;

export const SHIFT_EXTENSION_BONUS_APPLY_SQL = `
        -- Spec 68: asignación activa, solo renglón 'O' de un empleado con control (podólogo vinculado activo).
        OUTER APPLY (
          SELECT CAST(1 AS bit) AS asignado
            FROM [CentroPodologico].[payroll].[shift_extension_assignments] xa
           WHERE salary.tipo_nomina = 'O'
             AND xa.[id_empleado] = e.[id_empleado]
             AND xa.[activo] = 1
             AND ${ABSENCE_CONTROLLED_EMPLOYEE_CONDITION}
        ) AS extension_assignment
        OUTER APPLY (
          SELECT COUNT(*) AS dias FROM #shift_extension_days xd WHERE xd.[id_empleado] = e.[id_empleado]
        ) AS extension_counts`;

/**
 * Las tres columnas del snapshot que congelan el bono, en este orden y con sus expresiones sobre
 * `SHIFT_EXTENSION_BONUS_APPLY_SQL`: asignado, días e importe. Sin asignación van en 0 / 0 / 0, como exige
 * `CK_period_employees_bono_extension`.
 *
 * El importe es ROUND(salario_diario × multiplicador × horas / 8 × días, 2). Se multiplican los días antes de dividir
 * entre 8 para que la tarifa intermedia no se trunque (matemáticamente es lo mismo): solo se redondea el total.
 */
export const SHIFT_EXTENSION_BONUS_COLUMNS = [
  { column: "bono_extension_asignado", expression: "ISNULL(extension_assignment.asignado, 0)" },
  {
    column: "bono_extension_dias",
    expression: "CASE WHEN extension_assignment.asignado IS NULL THEN 0 ELSE extension_counts.dias END",
  },
  {
    column: "importe_bono_extension",
    expression: `CASE WHEN extension_assignment.asignado IS NULL THEN 0
                    ELSE ROUND(salary.salario_diario * ${SHIFT_EXTENSION_PAY_MULTIPLIER} * ${SHIFT_EXTENSION_HOURS_PER_DAY}
                               * extension_counts.dias / 8, 2) END`,
  },
] as const;

/** Lista de columnas para el INSERT, lista para pegar: `bono_extension_asignado, ...`. */
export const SHIFT_EXTENSION_BONUS_INSERT_COLUMNS_SQL = SHIFT_EXTENSION_BONUS_COLUMNS.map((entry) => entry.column).join(", ");

/** Lista de expresiones para el SELECT del INSERT, en el mismo orden que `SHIFT_EXTENSION_BONUS_INSERT_COLUMNS_SQL`. */
export const SHIFT_EXTENSION_BONUS_SELECT_SQL = SHIFT_EXTENSION_BONUS_COLUMNS.map((entry) => entry.expression).join(",\n               ");
