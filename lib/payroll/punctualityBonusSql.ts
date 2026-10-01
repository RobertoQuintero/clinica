import "server-only";

import { ABSENCE_CONTROLLED_EMPLOYEE_CONDITION } from "@/lib/payroll/eligibleEmployees";

/**
 * Fragmentos SQL del bono de puntualidad (spec 64), compartidos por `calculatePayrollPeriod` y por el aviso
 * "Recalcula" (`punctualityBonusRecalculation.ts`). lib/payroll/punctualityBonus.ts los espeja para la pantalla y,
 * si divergen, manda este SQL.
 *
 * Se pegan en el FROM de un SELECT sobre `[RH].[empleados] e` que ya tiene en alcance:
 * - `salary (tipo_nomina, ...)`: el bono solo existe en el renglón 'O';
 * - `lateness_settings`: el LEFT JOIN a `[payroll].[lateness_settings]` de la empresa (sin fila no se evalúa);
 * - `#lateness` y `#absences`: los retardos y faltas injustificados del periodo, con las mismas reglas de las
 *   specs 62 y 63 y sin el candado de descuento (un día que otro periodo ya descontó también cuenta);
 * - los parámetros @id_payment_period y @fecha_inicio del periodo.
 *
 * Los motivos de "No evaluado" se revisan en el orden de `PunctualityBonusSkipReason`; el SQL no necesita
 * distinguirlos: cualquiera deja el resultado en 'N' con ceros.
 */
export const PUNCTUALITY_BONUS_APPLY_SQL = `
        -- Spec 64: incidencias del bono = todos los retardos (graves y acumulables) más todas las faltas del periodo.
        OUTER APPLY (
          SELECT (SELECT COUNT(*) FROM #lateness bl WHERE bl.[id_empleado] = e.[id_empleado]) AS retardos,
                 (SELECT COUNT(*) FROM #absences ba WHERE ba.[id_empleado] = e.[id_empleado]) AS faltas
        ) AS bonus_counts
        -- Configuración aplicable: solo renglón 'O', empresa con lateness_settings, empleado con control, frecuencia con
        -- bono activo, ingreso a más tardar el primer día del periodo y al menos un horario. Sin fila = no evaluado.
        OUTER APPLY (
          SELECT bs.[monto], bs.[maximo_incidencias]
            FROM [CentroPodologico].[payroll].[punctuality_bonus_settings] bs
           WHERE salary.tipo_nomina = 'O'
             AND lateness_settings.[id_empresa] IS NOT NULL
             AND bs.[id_empresa] = e.[id_empresa]
             AND bs.[id_payment_period] = @id_payment_period
             AND bs.[status] = 1
             AND ${ABSENCE_CONTROLLED_EMPLOYEE_CONDITION}
             AND e.[fecha_ingreso] <= @fecha_inicio
             AND EXISTS (SELECT 1 FROM [CentroPodologico].[RH].[empleado_horarios] bh
                          WHERE bh.[id_empleado] = e.[id_empleado])
        ) AS bonus_setting
        CROSS APPLY (
          SELECT CASE WHEN bonus_setting.[maximo_incidencias] IS NULL THEN 'N'
                      WHEN bonus_counts.retardos + bonus_counts.faltas <= bonus_setting.[maximo_incidencias] THEN 'C'
                      ELSE 'P' END AS resultado
        ) AS bonus_result`;

/**
 * Las cinco columnas del snapshot que congelan el bono, en este orden y con sus expresiones sobre
 * `PUNCTUALITY_BONUS_APPLY_SQL`: resultado, retardos, faltas, máximo aplicado e importe. Con 'N' los conteos van en 0
 * y el máximo en NULL, como exige `CK_period_employees_bono_puntualidad`.
 */
export const PUNCTUALITY_BONUS_COLUMNS = [
  { column: "bono_puntualidad_resultado", expression: "bonus_result.resultado" },
  {
    column: "bono_puntualidad_retardos",
    expression: "CASE WHEN bonus_result.resultado = 'N' THEN 0 ELSE bonus_counts.retardos END",
  },
  {
    column: "bono_puntualidad_faltas",
    expression: "CASE WHEN bonus_result.resultado = 'N' THEN 0 ELSE bonus_counts.faltas END",
  },
  { column: "bono_puntualidad_maximo", expression: "bonus_setting.[maximo_incidencias]" },
  {
    column: "importe_bono_puntualidad",
    expression: "CASE WHEN bonus_result.resultado = 'C' THEN bonus_setting.[monto] ELSE 0 END",
  },
] as const;

/** Lista de columnas para el INSERT, lista para pegar: `bono_puntualidad_resultado, ...`. */
export const PUNCTUALITY_BONUS_INSERT_COLUMNS_SQL = PUNCTUALITY_BONUS_COLUMNS.map((entry) => entry.column).join(", ");

/** Lista de expresiones para el SELECT del INSERT, en el mismo orden que `PUNCTUALITY_BONUS_INSERT_COLUMNS_SQL`. */
export const PUNCTUALITY_BONUS_SELECT_SQL = PUNCTUALITY_BONUS_COLUMNS.map((entry) => entry.expression).join(",\n               ");
