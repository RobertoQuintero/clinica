import "server-only";

import db from "@/database/connection";
import { ISR_BRACKET_APPLY_SQL, ISR_COLUMNS_SQL, ISR_PARAMETERS_SQL } from "@/lib/payroll/isrSql";

/**
 * Condición "el desglose de hoy es distinto del snapshot" para las 18 columnas del ISR, armada con las mismas
 * expresiones que usa el cálculo (`ISR_COLUMNS_SQL`). `EXCEPT` compara NULL con NULL como iguales, así que un 'N'
 * contra un 'N' con el mismo motivo no cuenta como diferencia.
 */
const SNAPSHOT_DIFFERS_CONDITION = `EXISTS (
                   SELECT ${ISR_COLUMNS_SQL.map(({ column }) => `pe.[${column}]`).join(", ")}
                   EXCEPT
                   SELECT ${ISR_COLUMNS_SQL.map(({ expression }) => expression).join(", ")})`;

/**
 * Aviso "Recalcula" del ISR (spec 70): ¿el ISR que saldría hoy ya no coincide con lo que congeló el último cálculo?
 * Solo aplica a periodos en estatus 2 (En cálculo); en cualquier otro estatus responde false.
 * Recalcula el desglose de cada renglón 'F' con la tarifa y los parámetros de hoy, sobre la base y los días del
 * snapshot, y lo compara con lo guardado: estado, motivo, ejercicio, tramo, ISR causado, los 3 parámetros con su
 * vigencia, subsidio e ISR retenido. Así ve cambios de tarifa, de parámetros o de vigencia; `tablas_retencion` no tiene
 * `updated_at` con qué compararlo. Un renglón 'F' en 'X' (calculado antes de la spec 70) también lo activa.
 *
 * Un solo batch con los fragmentos de `isrSql.ts`, los mismos del cálculo.
 */
export async function isIsrRecalculationNeeded(idPeriod: number): Promise<boolean> {
  const rows = await db.queryParams(
    `SET NOCOUNT ON;
     DECLARE @id_payment_period smallint, @fecha_fin date;
     SELECT @id_payment_period = id_payment_period,
            @fecha_fin         = fecha_fin
       FROM [CentroPodologico].[payroll].[periods]
      WHERE id_period = @id_period AND status = 2;
     IF @id_payment_period IS NULL
     BEGIN
       SELECT 0 AS recalculation_needed;
       RETURN;
     END
     ${ISR_PARAMETERS_SQL}

     SELECT CASE WHEN EXISTS (
              SELECT 1
                FROM [CentroPodologico].[payroll].[period_employees] pe${ISR_BRACKET_APPLY_SQL}
               WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F'
                 AND ${SNAPSHOT_DIFFERS_CONDITION}
            ) THEN 1 ELSE 0 END AS recalculation_needed;`,
    { id_period: idPeriod },
  );
  return Number(rows[0]?.recalculation_needed ?? 0) === 1;
}
