import "server-only";

import type { Article174SkipReason } from "@/interfaces/payroll_christmas_bonus";
import {
  ARTICLE_174_MONTH_DAYS_FACTOR,
  CHRISTMAS_BONUS_YEAR_DAYS,
  MONTHLY_WITHHOLDING_SAT_KEY,
} from "@/lib/payroll/constants";

/**
 * Fragmentos SQL del ISR art. 174 RLISR del aguinaldo (spec 87), compartidos por `calculatePayrollPeriod` y por el
 * aviso "Recalcula" (`christmasBonusRecalculation.ts`). `lib/payroll/isrArticle174.ts` los espeja y, si divergen,
 * manda este SQL.
 *
 * `ARTICLE_174_PARAMETERS_SQL` declara las variables `@article174_*`; necesita @fecha_fin y se pega en el batch antes
 * de la sentencia que usa `ARTICLE_174_APPLY_SQL`. Este último se pega en el FROM de una sentencia sobre
 * `[payroll].[period_employees] pe` (con `id_period_employee` y `salario_diario`) y toma el gravado y el estado del
 * exento de sus filas de `period_employee_perceptions`. `ARTICLE_174_COLUMNS_SQL` lista las columnas del desglose con su
 * expresión sobre esos fragmentos.
 *
 * Todo el redondeo imita al espejo TS, que opera en enteros: se multiplica antes de dividir, y la tasa se calcula en
 * enteros (bigint) para que el redondeo sea mitad hacia arriba y no un truncamiento de la división decimal.
 */

function skipReasonLiteral(reason: Article174SkipReason): string {
  return `'${reason}'`;
}

/** Tarifa mensual del año de fecha_fin (la frecuencia se resuelve por clave SAT, nunca por un id fijo). */
export const ARTICLE_174_PARAMETERS_SQL = `
       -- Spec 87: tarifa mensual del ejercicio de fecha_fin para el ISR art. 174.
       DECLARE @article174_year int = YEAR(@fecha_fin), @article174_monthly_id smallint, @article174_has_table bit;
       SELECT @article174_monthly_id = [id_payment_period]
         FROM [CentroPodologico].[RH].[payment_periods]
        WHERE [clave_sat] = '${MONTHLY_WITHHOLDING_SAT_KEY}';
       SELECT @article174_has_table = CASE WHEN EXISTS (
                SELECT 1 FROM [CentroPodologico].[payroll].[tablas_retencion] t
                 WHERE t.[ejercicio] = @article174_year AND t.[id_payment_period] = @article174_monthly_id
              ) THEN 1 ELSE 0 END;`;

/**
 * Desglose por renglón 'F':
 * - `article174_base`: gravado del aguinaldo (suma de sus percepciones) y si alguna quedó con el exento sin calcular.
 * - `article174_income`: ingreso ordinario mensual = ROUND(salario × 30.4, 2) y parte mensualizada =
 *   ROUND(gravado × 30.4 / 365, 2).
 * - `article174_ordinary_bracket` y `article174_total_bracket`: el tramo del ordinario solo y del ordinario + parte
 *   (con gravado 0 no se busca tramo: ISR 0).
 * - `article174_skip`: motivo de "No calculado", en orden: exento pendiente, sin tarifa mensual, hueco.
 * - `article174_isr`: ISR de cada tarifa = ROUND(cuota + (ingreso − límite inferior) × porcentaje / 100, 2).
 * - `article174_rate`: tasa = ROUND(diferencia / parte, 6), en enteros; 0 si la parte es 0.
 */
export const ARTICLE_174_APPLY_SQL = `
        -- Spec 87: base, ingreso ordinario, tramos, motivo, ISR de cada tarifa, tasa e ISR retenido del aguinaldo.
        CROSS APPLY (
          SELECT CAST(ISNULL(SUM(pep.[importe_gravado]), 0) AS decimal(18,2)) AS gravado,
                 CAST(ISNULL(MAX(CASE WHEN pep.[exencion_estado] = 'N' THEN 1 ELSE 0 END), 0) AS bit) AS pendiente
            FROM [CentroPodologico].[payroll].[period_employee_perceptions] pep
           WHERE pep.[id_period_employee] = pe.[id_period_employee]
        ) AS article174_base
        CROSS APPLY (
          SELECT CAST(ROUND(pe.[salario_diario] * ${ARTICLE_174_MONTH_DAYS_FACTOR}, 2) AS decimal(18,2)) AS ordinario,
                 CAST(ROUND(article174_base.gravado * ${ARTICLE_174_MONTH_DAYS_FACTOR} / ${CHRISTMAS_BONUS_YEAR_DAYS}, 2) AS decimal(18,2)) AS parte
        ) AS article174_income
        CROSS APPLY (
          SELECT CAST(article174_income.ordinario + article174_income.parte AS decimal(18,2)) AS total
        ) AS article174_sum
        OUTER APPLY (
          SELECT TOP 1 t.[limite_inferior], t.[cuota_fija], t.[porcentaje_excedente]
            FROM [CentroPodologico].[payroll].[tablas_retencion] t
           WHERE t.[ejercicio] = @article174_year AND t.[id_payment_period] = @article174_monthly_id
             AND article174_base.gravado > 0
             AND t.[limite_inferior] <= article174_income.ordinario
             AND (t.[limite_superior] IS NULL OR article174_income.ordinario <= t.[limite_superior])
           ORDER BY t.[limite_inferior] DESC
        ) AS article174_ordinary_bracket
        OUTER APPLY (
          SELECT TOP 1 t.[limite_inferior], t.[cuota_fija], t.[porcentaje_excedente]
            FROM [CentroPodologico].[payroll].[tablas_retencion] t
           WHERE t.[ejercicio] = @article174_year AND t.[id_payment_period] = @article174_monthly_id
             AND article174_base.gravado > 0
             AND t.[limite_inferior] <= article174_sum.total
             AND (t.[limite_superior] IS NULL OR article174_sum.total <= t.[limite_superior])
           ORDER BY t.[limite_inferior] DESC
        ) AS article174_total_bracket
        CROSS APPLY (
          SELECT CAST(CASE WHEN article174_base.pendiente = 1 THEN ${skipReasonLiteral("exemption_not_calculated")}
                           WHEN @article174_has_table = 0 THEN ${skipReasonLiteral("no_monthly_withholding_table")}
                           WHEN article174_base.gravado > 0
                                AND (article174_ordinary_bracket.[limite_inferior] IS NULL
                                     OR article174_total_bracket.[limite_inferior] IS NULL)
                             THEN ${skipReasonLiteral("income_in_gap")}
                      END AS varchar(30)) AS motivo
        ) AS article174_skip
        CROSS APPLY (
          SELECT CAST(CASE WHEN article174_skip.motivo IS NOT NULL THEN NULL
                           WHEN article174_base.gravado = 0 THEN 0
                           ELSE ROUND(article174_ordinary_bracket.[cuota_fija]
                                      + (article174_income.ordinario - article174_ordinary_bracket.[limite_inferior])
                                        * article174_ordinary_bracket.[porcentaje_excedente] / 100, 2)
                      END AS decimal(18,2)) AS ordinario,
                 CAST(CASE WHEN article174_skip.motivo IS NOT NULL THEN NULL
                           WHEN article174_base.gravado = 0 THEN 0
                           ELSE ROUND(article174_total_bracket.[cuota_fija]
                                      + (article174_sum.total - article174_total_bracket.[limite_inferior])
                                        * article174_total_bracket.[porcentaje_excedente] / 100, 2)
                      END AS decimal(18,2)) AS total
        ) AS article174_isr
        CROSS APPLY (
          SELECT CAST(article174_isr.total - article174_isr.ordinario AS decimal(18,2)) AS diferencia
        ) AS article174_difference
        CROSS APPLY (
          SELECT CAST(CASE WHEN article174_skip.motivo IS NOT NULL THEN NULL
                           WHEN article174_income.parte = 0 THEN 0
                           ELSE SIGN(article174_difference.diferencia)
                                * ((2 * ABS(CAST(article174_difference.diferencia * 100 AS bigint)) * 1000000
                                    + CAST(article174_income.parte * 100 AS bigint))
                                   / (2 * CAST(article174_income.parte * 100 AS bigint)))
                      END AS bigint) AS escalada
        ) AS article174_scaled_rate
        CROSS APPLY (
          SELECT CAST(article174_scaled_rate.escalada / 1000000.0 AS decimal(9,6)) AS tasa
        ) AS article174_rate`;

/** Columna del desglose solo cuando se calculó ('C'); en 'N' van NULL salvo estado, motivo y base. */
function whenCalculated(expression: string): string {
  return `CASE WHEN article174_skip.motivo IS NULL THEN ${expression} END`;
}

/** Tramo solo si hubo base gravable: con gravado 0 el ISR es 0 y no se usa ningún tramo. */
function whenBracketUsed(expression: string): string {
  return `CASE WHEN article174_skip.motivo IS NULL AND article174_base.gravado > 0 THEN ${expression} END`;
}

export const ARTICLE_174_COLUMNS_SQL = [
  { column: "id_period_employee",        expression: "pe.[id_period_employee]" },
  { column: "isr_estado",                expression: "CAST(CASE WHEN article174_skip.motivo IS NULL THEN 'C' ELSE 'N' END AS char(1))" },
  { column: "isr_motivo",                expression: "article174_skip.motivo" },
  {
    column: "base_gravable",
    expression: `CASE WHEN article174_skip.motivo = ${skipReasonLiteral("exemption_not_calculated")} THEN NULL ELSE article174_base.gravado END`,
  },
  { column: "ingreso_ordinario_mensual", expression: whenCalculated("article174_income.ordinario") },
  { column: "parte_mensualizada",        expression: whenCalculated("article174_income.parte") },
  { column: "ejercicio_tarifa",          expression: whenCalculated("@article174_year") },
  { column: "limite_inferior_ordinario", expression: whenBracketUsed("article174_ordinary_bracket.[limite_inferior]") },
  { column: "cuota_fija_ordinario",      expression: whenBracketUsed("article174_ordinary_bracket.[cuota_fija]") },
  { column: "porcentaje_ordinario",      expression: whenBracketUsed("article174_ordinary_bracket.[porcentaje_excedente]") },
  { column: "isr_ordinario",             expression: "article174_isr.ordinario" },
  { column: "limite_inferior_total",     expression: whenBracketUsed("article174_total_bracket.[limite_inferior]") },
  { column: "cuota_fija_total",          expression: whenBracketUsed("article174_total_bracket.[cuota_fija]") },
  { column: "porcentaje_total",          expression: whenBracketUsed("article174_total_bracket.[porcentaje_excedente]") },
  { column: "isr_total",                 expression: "article174_isr.total" },
  { column: "diferencia_isr",            expression: "CASE WHEN article174_skip.motivo IS NULL THEN article174_difference.diferencia END" },
  { column: "tasa",                      expression: "CASE WHEN article174_skip.motivo IS NULL THEN article174_rate.tasa END" },
  {
    column: "isr_retenido",
    expression: "CASE WHEN article174_skip.motivo IS NULL THEN ROUND(article174_base.gravado * article174_rate.tasa, 2) END",
  },
] as const;

/** Lista de columnas y de expresiones para el `INSERT … SELECT` del desglose. */
export const ARTICLE_174_INSERT_COLUMNS_SQL = ARTICLE_174_COLUMNS_SQL.map(({ column }) => `[${column}]`).join(", ");
export const ARTICLE_174_SELECT_SQL = ARTICLE_174_COLUMNS_SQL.map(({ expression }) => expression).join(",\n              ");
