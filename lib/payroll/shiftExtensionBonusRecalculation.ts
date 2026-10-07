import "server-only";

import db from "@/database/connection";
import {
  SHIFT_EXTENSION_BONUS_APPLY_SQL,
  SHIFT_EXTENSION_BONUS_COLUMNS,
  SHIFT_EXTENSION_WORKED_DAYS_SQL,
} from "@/lib/payroll/shiftExtensionBonusSql";

/**
 * Condición "el valor de hoy es distinto del snapshot" para las tres columnas del bono, armada con las mismas
 * expresiones que usa el cálculo (`SHIFT_EXTENSION_BONUS_COLUMNS`). Las tres se comparan como número: el asignado es
 * un bit y cabe en un decimal.
 */
const SNAPSHOT_DIFFERS_CONDITION = SHIFT_EXTENSION_BONUS_COLUMNS.map(
  ({ column, expression }) => `CAST(pe.[${column}] AS decimal(14,2)) <> CAST(${expression} AS decimal(14,2))`,
).join("\n                    OR ");

/**
 * Aviso "Recalcula" del bono por extensión de jornada (spec 68): ¿el bono que saldría hoy ya no coincide con lo que
 * congeló el último cálculo? Solo aplica a periodos en estatus 2 (En cálculo); en cualquier otro estatus responde false.
 * Responde true cuando el resultado de hoy (asignado, días o importe) de algún renglón 'O' es distinto del snapshot.
 * Ve asignaciones nuevas o quitadas, checadas nuevas, cambios de horario o de usuario podólogo. No compara fechas de
 * asignación: el snapshot guarda `bono_extension_asignado`, así que el resultado ya las ve.
 *
 * El importe de hoy se calcula con el `salario_diario` del snapshot, así que un cambio de salario no activa el aviso,
 * igual que en el resto de la nómina.
 *
 * Un solo batch: arma `#shift_extension_days` y evalúa el bono con los fragmentos de `shiftExtensionBonusSql.ts`, los
 * mismos del cálculo.
 */
export async function isShiftExtensionBonusRecalculationNeeded(idPeriod: number): Promise<boolean> {
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
     ${SHIFT_EXTENSION_WORKED_DAYS_SQL}

     SELECT CASE WHEN EXISTS (
              SELECT 1
                FROM [CentroPodologico].[payroll].[period_employees] pe
                JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = pe.[id_empleado]
               CROSS APPLY (SELECT CAST('O' AS char(1)) AS tipo_nomina, pe.[salario_diario] AS salario_diario) AS salary${SHIFT_EXTENSION_BONUS_APPLY_SQL}
               WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'O'
                 AND (${SNAPSHOT_DIFFERS_CONDITION})
            ) THEN 1 ELSE 0 END AS recalculation_needed;`,
    { id_period: idPeriod },
  );
  return Number(rows[0]?.recalculation_needed ?? 0) === 1;
}
