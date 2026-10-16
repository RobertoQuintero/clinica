import "server-only";

import db from "@/database/connection";
import {
  ARTICLE_174_APPLY_SQL,
  ARTICLE_174_COLUMNS_SQL,
  ARTICLE_174_PARAMETERS_SQL,
} from "@/lib/payroll/isrArticle174Sql";

/**
 * Condición "el desglose del art. 174 de hoy es distinto del guardado", armada con las mismas expresiones que usa el
 * cálculo (`ARTICLE_174_COLUMNS_SQL`). Compara contra la fila guardada `stored`; `EXCEPT` trata NULL como igual a NULL,
 * así que un 'N' contra un 'N' con el mismo motivo no cuenta como diferencia.
 */
const ARTICLE_174_DIFFERS_CONDITION = `EXISTS (
                   SELECT ${ARTICLE_174_COLUMNS_SQL.map(({ column }) => `stored.[${column}]`).join(", ")}
                   EXCEPT
                   SELECT ${ARTICLE_174_COLUMNS_SQL.map(({ expression }) => expression).join(", ")})`;

/**
 * Aviso "Recalcula" del aguinaldo (spec 87): ¿lo que saldría hoy ya no coincide con lo que congeló el último cálculo?
 * Solo aplica a periodos extraordinarios en estatus 2 (En cálculo); en cualquier otro caso responde false.
 *
 * Se activa cuando, respecto del snapshot:
 * - cambió el salario diario de su tipo ('O' o 'F') o la fecha de ingreso (los días se recalculan con la fecha de hoy);
 * - el ISR del art. 174 de hoy no coincide con el guardado: la tarifa mensual del año o el ingreso ordinario
 *   (que sale del salario fiscal) ya no son los usados.
 * La UMA y la regla de exento del catálogo las ve el aviso de exento de la spec 73, que también aplica a este periodo.
 *
 * Un solo batch con los fragmentos de `isrArticle174Sql.ts`, los mismos del cálculo.
 */
export async function isChristmasBonusRecalculationNeeded(idPeriod: number): Promise<boolean> {
  const rows = await db.queryParams(
    `SET NOCOUNT ON;
     DECLARE @fecha_inicio date, @fecha_fin date;
     SELECT @fecha_inicio = fecha_inicio,
            @fecha_fin    = fecha_fin
       FROM [CentroPodologico].[payroll].[periods]
      WHERE id_period = @id_period AND status = 2 AND tipo_periodo = 'E';
     IF @fecha_fin IS NULL
     BEGIN
       SELECT 0 AS recalculation_needed;
       RETURN;
     END
     ${ARTICLE_174_PARAMETERS_SQL}

     SELECT CASE
              WHEN EXISTS (
                SELECT 1
                  FROM [CentroPodologico].[payroll].[period_employees] pe
                  JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = pe.[id_empleado]
                 WHERE pe.[id_period] = @id_period
                   AND (pe.[salario_diario] <> ISNULL(CASE pe.[tipo_nomina] WHEN 'O' THEN e.[salario_diario]
                                                                              ELSE e.[salario_diario_fiscal] END, 0)
                        OR pe.[dias_aguinaldo] <> DATEDIFF(day,
                              CASE WHEN e.[fecha_ingreso] > @fecha_inicio THEN e.[fecha_ingreso] ELSE @fecha_inicio END,
                              @fecha_fin) + 1)
              ) THEN 1
              WHEN EXISTS (
                SELECT 1
                  FROM [CentroPodologico].[payroll].[period_employees] pe
                  JOIN [CentroPodologico].[payroll].[period_employee_isr_article174] stored
                    ON stored.[id_period_employee] = pe.[id_period_employee]${ARTICLE_174_APPLY_SQL}
                 WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F'
                   AND ${ARTICLE_174_DIFFERS_CONDITION}
              ) THEN 1
              ELSE 0
            END AS recalculation_needed;`,
    { id_period: idPeriod },
  );
  return Number(rows[0]?.recalculation_needed ?? 0) === 1;
}
