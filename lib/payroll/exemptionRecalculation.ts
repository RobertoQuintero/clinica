import "server-only";

import db from "@/database/connection";
import { SALARY_PERCEPTION_ID } from "@/lib/payroll/constants";
import {
  EXEMPTION_APPLY_SQL,
  EXEMPTION_COLUMNS_SQL,
  EXEMPTION_PARAMETERS_SQL,
} from "@/lib/payroll/exemptionSql";

/**
 * Condición "el desglose de hoy es distinto del renglón guardado", armada con las mismas expresiones que usa el
 * cálculo (`EXEMPTION_COLUMNS_SQL`). `EXCEPT` compara NULL con NULL como iguales.
 */
const STORED_PERCEPTION_DIFFERS_CONDITION = `EXISTS (
                   SELECT ${EXEMPTION_COLUMNS_SQL.map(({ column }) => `fl.[${column}]`).join(", ")}
                   EXCEPT
                   SELECT ${EXEMPTION_COLUMNS_SQL.map(({ expression }) => expression).join(", ")})`;

/**
 * Aviso "Recalcula" del gravado/exento (spec 73): ¿el exento que saldría hoy ya no coincide con lo que congeló el
 * último cálculo? Solo aplica a periodos en estatus 2 (En cálculo); en cualquier otro estatus responde false.
 *
 * Recalcula cada renglón de percepción guardado con el catálogo, la UMA y los acumulados de hoy, sobre el `importe`
 * y los `eventos` guardados, y lo compara con lo que quedó congelado. Así ve cambios en la regla del catálogo, en la
 * UMA vigente o en lo exentado por periodos anteriores. También se activa con un renglón 'F' con sueldo y sin su
 * renglón de sueldo (calculado antes de la spec 73).
 *
 * Un solo batch con los fragmentos de `exemptionSql.ts`, los mismos del cálculo.
 */
export async function isExemptionRecalculationNeeded(idPeriod: number): Promise<boolean> {
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
     ${EXEMPTION_PARAMETERS_SQL}

     SELECT CASE
              WHEN EXISTS (
                SELECT 1
                  FROM [CentroPodologico].[payroll].[period_employees] pe
                 WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F' AND pe.[importe_salario] > 0
                   AND NOT EXISTS (
                     SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_perceptions] salary_row
                      WHERE salary_row.[id_period_employee] = pe.[id_period_employee]
                        AND salary_row.[id_perception] = ${SALARY_PERCEPTION_ID})
              ) THEN 1
              WHEN EXISTS (
                SELECT 1
                  FROM [CentroPodologico].[payroll].[period_employee_perceptions] fl
                  JOIN [CentroPodologico].[payroll].[period_employees] pe
                    ON pe.[id_period_employee] = fl.[id_period_employee]
                  JOIN [CentroPodologico].[payroll].[perceptions] exemption_rule
                    ON exemption_rule.[id_perception] = fl.[id_perception]${EXEMPTION_APPLY_SQL}
                 WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F'
                   AND ${STORED_PERCEPTION_DIFFERS_CONDITION}
              ) THEN 1
              ELSE 0
            END AS recalculation_needed;`,
    { id_period: idPeriod },
  );
  return Number(rows[0]?.recalculation_needed ?? 0) === 1;
}
