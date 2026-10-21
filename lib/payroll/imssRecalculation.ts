import "server-only";

import db from "@/database/connection";
import { IMSS_APPLY_SQL, IMSS_COLUMNS_SQL, IMSS_PARAMETERS_SQL } from "@/lib/payroll/imssSql";

/**
 * Condición "el cálculo de hoy es distinto del snapshot", armada con las mismas expresiones que usa el cálculo
 * (`IMSS_COLUMNS_SQL`). Compara el estado, el motivo y las 30 columnas del desglose (que solo existe para los 'C',
 * por eso la expresión de hoy se anula cuando el estado de hoy no es 'C'). `EXCEPT` compara NULL con NULL como
 * iguales, así que un 'N' contra un 'N' con el mismo motivo, o un 'X' contra un 'X', no cuenta como diferencia.
 */
const SNAPSHOT_DIFFERS_CONDITION = `EXISTS (
                   SELECT pe.[imss_estado], pe.[imss_motivo], ${IMSS_COLUMNS_SQL.map(({ column }) => `snapshot.[${column}]`).join(", ")}
                   EXCEPT
                   SELECT imss_state.estado, imss_state.motivo,
                          ${IMSS_COLUMNS_SQL.map(({ expression }) => `CASE WHEN imss_state.estado = 'C' THEN ${expression} END`).join(",\n                          ")})`;

/** Batch del aviso: recibe `@id_period` y devuelve `recalculation_needed` (0 o 1). */
export const IMSS_RECALCULATION_CHECK_SQL = `SET NOCOUNT ON;
     DECLARE @fecha_fin date;
     SELECT @fecha_fin = fecha_fin
       FROM [CentroPodologico].[payroll].[periods]
      WHERE id_period = @id_period AND status = 2 AND tipo_periodo = 'O';
     IF @fecha_fin IS NULL
     BEGIN
       SELECT 0 AS recalculation_needed;
       RETURN;
     END
     ${IMSS_PARAMETERS_SQL}

     SELECT CASE WHEN EXISTS (
              SELECT 1
                FROM [CentroPodologico].[payroll].[period_employees] pe
                LEFT JOIN [CentroPodologico].[payroll].[period_employee_imss] snapshot
                       ON snapshot.[id_period_employee] = pe.[id_period_employee]${IMSS_APPLY_SQL}
               WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F'
                 AND ${SNAPSHOT_DIFFERS_CONDITION}
            ) THEN 1 ELSE 0 END AS recalculation_needed;`;

/**
 * Aviso "Recalcula" del IMSS (spec 91): ¿la cuota obrera que saldría hoy ya no coincide con lo que congeló el último
 * cálculo? Solo aplica a periodos ordinarios en estatus 2 (En cálculo); en cualquier otro caso responde false. Un
 * periodo extraordinario (aguinaldo y PTU) no lleva IMSS.
 * Recalcula el estado y el desglose de cada renglón 'F' con el SBC, las tasas, la UMA, el salario mínimo, el régimen y
 * el NSS de hoy, sobre los días, el salario, el ISR y las percepciones del snapshot, y lo compara con lo guardado.
 * Así ve cambios de tasa, de UMA, de salario mínimo, de SBC, de régimen o de NSS. Un renglón 'F' en 'X' de un empleado
 * de régimen 02 (calculado antes de la spec 91) también lo activa.
 *
 * Un solo batch con los fragmentos de `imssSql.ts`, los mismos del cálculo.
 */
export async function isImssRecalculationNeeded(idPeriod: number): Promise<boolean> {
  const rows = await db.queryParams(IMSS_RECALCULATION_CHECK_SQL, { id_period: idPeriod });
  return Number(rows[0]?.recalculation_needed ?? 0) === 1;
}
