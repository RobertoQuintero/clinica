import "server-only";

import { ABSENCE_CONTROLLED_EMPLOYEE_CONDITION } from "@/lib/payroll/eligibleEmployees";

/**
 * Fragmentos SQL del bono de asistencia (spec 65), compartidos por `calculatePayrollPeriod` y por el aviso
 * "Recalcula" (`attendanceBonusRecalculation.ts`). lib/payroll/attendanceBonus.ts los espeja para la pantalla y,
 * si divergen, manda este SQL.
 *
 * Se pegan en el FROM de un SELECT sobre `[RH].[empleados] e` que ya tiene en alcance:
 * - `salary (tipo_nomina, ...)`: el bono solo existe en el renglón 'O';
 * - `#absences`: las faltas injustificadas del periodo, con las reglas de la spec 62 y sin el candado de descuento
 *   (un día que otro periodo ya descontó también cuenta);
 * - los parámetros @id_payment_period y @fecha_inicio del periodo.
 *
 * Los alias son propios (`attendance_*`) para convivir en el mismo SELECT con los `bonus_*` de puntualidad. No depende
 * de `lateness_settings`: los retardos no afectan este bono. Los motivos de "No evaluado" se revisan en el orden de
 * `AttendanceBonusSkipReason`; el SQL no necesita distinguirlos: cualquiera deja el resultado en 'N' con ceros.
 */
export const ATTENDANCE_BONUS_APPLY_SQL = `
        -- Spec 65: faltas injustificadas del periodo (el bono no tiene máximo: una sola lo quita).
        OUTER APPLY (
          SELECT COUNT(*) AS faltas FROM #absences aa WHERE aa.[id_empleado] = e.[id_empleado]
        ) AS attendance_counts
        -- Configuración aplicable: solo renglón 'O', empleado con control, frecuencia con bono activo, ingreso a más
        -- tardar el primer día del periodo y al menos un horario. Sin fila = no evaluado.
        OUTER APPLY (
          SELECT bs.[monto]
            FROM [CentroPodologico].[payroll].[attendance_bonus_settings] bs
           WHERE salary.tipo_nomina = 'O'
             AND bs.[id_empresa] = e.[id_empresa]
             AND bs.[id_payment_period] = @id_payment_period
             AND bs.[status] = 1
             AND ${ABSENCE_CONTROLLED_EMPLOYEE_CONDITION}
             AND e.[fecha_ingreso] <= @fecha_inicio
             AND EXISTS (SELECT 1 FROM [CentroPodologico].[RH].[empleado_horarios] ah
                          WHERE ah.[id_empleado] = e.[id_empleado])
        ) AS attendance_setting
        CROSS APPLY (
          SELECT CASE WHEN attendance_setting.[monto] IS NULL THEN 'N'
                      WHEN attendance_counts.faltas = 0 THEN 'C'
                      ELSE 'P' END AS resultado
        ) AS attendance_result`;

/**
 * Las tres columnas del snapshot que congelan el bono, en este orden y con sus expresiones sobre
 * `ATTENDANCE_BONUS_APPLY_SQL`: resultado, faltas e importe. Con 'N' las faltas van en 0, como exige
 * `CK_period_employees_bono_asistencia`.
 */
export const ATTENDANCE_BONUS_COLUMNS = [
  { column: "bono_asistencia_resultado", expression: "attendance_result.resultado" },
  {
    column: "bono_asistencia_faltas",
    expression: "CASE WHEN attendance_result.resultado = 'N' THEN 0 ELSE attendance_counts.faltas END",
  },
  {
    column: "importe_bono_asistencia",
    expression: "CASE WHEN attendance_result.resultado = 'C' THEN attendance_setting.[monto] ELSE 0 END",
  },
] as const;

/** Lista de columnas para el INSERT, lista para pegar: `bono_asistencia_resultado, ...`. */
export const ATTENDANCE_BONUS_INSERT_COLUMNS_SQL = ATTENDANCE_BONUS_COLUMNS.map((entry) => entry.column).join(", ");

/** Lista de expresiones para el SELECT del INSERT, en el mismo orden que `ATTENDANCE_BONUS_INSERT_COLUMNS_SQL`. */
export const ATTENDANCE_BONUS_SELECT_SQL = ATTENDANCE_BONUS_COLUMNS.map((entry) => entry.expression).join(",\n               ");
