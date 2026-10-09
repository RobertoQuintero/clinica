import "server-only";

import type { IsrSkipReason } from "@/interfaces/payroll_isr";

/**
 * Fragmentos SQL del ISR de la nómina fiscal (spec 70), compartidos por `calculatePayrollPeriod` y por el aviso
 * "Recalcula" (`isrRecalculation.ts`). lib/payroll/isrCalculation.ts los espeja para las pantallas y, si divergen,
 * manda este SQL.
 *
 * `ISR_PARAMETERS_SQL` declara y resuelve las variables `@isr_*`; necesita @fecha_fin del periodo y se pega en el
 * batch antes de la sentencia que usa `ISR_BRACKET_APPLY_SQL`. Este último se pega en el FROM de una sentencia sobre
 * `[payroll].[period_employees] pe` (ya con `importe_salario` y `dias` calculados) y necesita @id_payment_period.
 * `ISR_COLUMNS_SQL` lista las 18 columnas del desglose con su expresión sobre esos dos fragmentos.
 *
 * La base gravable es `pe.importe_salario` (hoy la única percepción fiscal, gravada al 100%) y los días del subsidio
 * son `pe.dias` (días pagados, ya sin faltas). Solo se aplica a renglones 'F'.
 */

function skipReasonLiteral(reason: IsrSkipReason): string {
  return `'${reason}'`;
}

/**
 * Ejercicio de la tarifa (año de fecha_fin) y los 3 parámetros del subsidio vigentes a fecha_fin, con su
 * `vigente_desde`: la fila más reciente con `vigente_desde <= fecha_fin`. Sin fila, la variable queda NULL.
 */
export const ISR_PARAMETERS_SQL = `
       -- Spec 70: ejercicio de la tarifa y parámetros del subsidio vigentes a fecha_fin.
       DECLARE @isr_fiscal_year smallint = YEAR(@fecha_fin);
       DECLARE @isr_subsidy_amount decimal(18,4), @isr_subsidy_amount_since date,
               @isr_subsidy_cap    decimal(18,4), @isr_subsidy_cap_since    date,
               @isr_subsidy_factor decimal(18,4), @isr_subsidy_factor_since date;
       SELECT TOP 1 @isr_subsidy_amount = [valor], @isr_subsidy_amount_since = [vigente_desde]
         FROM [CentroPodologico].[payroll].[tax_parameters]
        WHERE [clave] = 'SUBSIDIO_MONTO_MENSUAL' AND [vigente_desde] <= @fecha_fin
        ORDER BY [vigente_desde] DESC;
       SELECT TOP 1 @isr_subsidy_cap = [valor], @isr_subsidy_cap_since = [vigente_desde]
         FROM [CentroPodologico].[payroll].[tax_parameters]
        WHERE [clave] = 'SUBSIDIO_TOPE_INGRESO_MENSUAL' AND [vigente_desde] <= @fecha_fin
        ORDER BY [vigente_desde] DESC;
       SELECT TOP 1 @isr_subsidy_factor = [valor], @isr_subsidy_factor_since = [vigente_desde]
         FROM [CentroPodologico].[payroll].[tax_parameters]
        WHERE [clave] = 'SUBSIDIO_FACTOR_DIAS_MES' AND [vigente_desde] <= @fecha_fin
        ORDER BY [vigente_desde] DESC;`;

/**
 * Tramo y cálculo por renglón:
 * - `isr_table`: si hay tarifa para la frecuencia y el ejercicio.
 * - `isr_bracket`: el tramo de mayor `limite_inferior <= base` que contiene la base (como `findWithholdingBracket`).
 *   Con base 0 no se busca tramo: queda calculado en 0 sin tramo.
 * - `isr_skip`: motivo de "No calculado", en orden: tarifa, parámetros del subsidio, hueco. NULL si se calcula.
 * - `isr_tax`: ISR causado = ROUND(cuota_fija + (base − limite_inferior) × porcentaje / 100, 2), y el derecho al
 *   subsidio sin divisiones (base × factor <= tope × dias).
 * - `isr_subsidy`: subsidio causado = ROUND(monto × dias / factor, 2); se multiplica antes de dividir para no
 *   truncar la tasa diaria intermedia (matemáticamente es monto / factor × dias).
 * - `isr_applied`: subsidio aplicado = min(subsidio causado, ISR causado). Nunca hay saldo a favor.
 */
export const ISR_BRACKET_APPLY_SQL = `
        -- Spec 70: tarifa del periodo, tramo de la base y desglose del ISR.
        OUTER APPLY (
          SELECT CASE WHEN EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[tablas_retencion] t
                                    WHERE t.[ejercicio] = @isr_fiscal_year AND t.[id_payment_period] = @id_payment_period)
                      THEN 1 ELSE 0 END AS has_table
        ) AS isr_table
        OUTER APPLY (
          SELECT TOP 1 t.[limite_inferior], t.[cuota_fija], t.[porcentaje_excedente]
            FROM [CentroPodologico].[payroll].[tablas_retencion] t
           WHERE t.[ejercicio] = @isr_fiscal_year AND t.[id_payment_period] = @id_payment_period
             AND pe.[importe_salario] > 0
             AND t.[limite_inferior] <= pe.[importe_salario]
             AND (t.[limite_superior] IS NULL OR pe.[importe_salario] <= t.[limite_superior])
           ORDER BY t.[limite_inferior] DESC
        ) AS isr_bracket
        CROSS APPLY (
          SELECT CAST(CASE WHEN isr_table.has_table = 0 THEN ${skipReasonLiteral("no_withholding_table")}
                           WHEN @isr_subsidy_amount IS NULL OR @isr_subsidy_cap IS NULL OR @isr_subsidy_factor IS NULL
                             THEN ${skipReasonLiteral("missing_subsidy_parameters")}
                           WHEN pe.[importe_salario] > 0 AND isr_bracket.[limite_inferior] IS NULL
                             THEN ${skipReasonLiteral("income_in_gap")}
                      END AS varchar(30)) AS motivo
        ) AS isr_skip
        CROSS APPLY (
          SELECT CAST(CASE WHEN isr_skip.motivo IS NOT NULL THEN NULL
                           WHEN isr_bracket.[limite_inferior] IS NULL THEN 0
                           ELSE ROUND(isr_bracket.[cuota_fija]
                                      + (pe.[importe_salario] - isr_bracket.[limite_inferior])
                                        * isr_bracket.[porcentaje_excedente] / 100, 2)
                      END AS decimal(12,2)) AS causado,
                 CAST(CASE WHEN isr_skip.motivo IS NOT NULL THEN NULL
                           WHEN pe.[importe_salario] * @isr_subsidy_factor <= @isr_subsidy_cap * pe.[dias] THEN 1
                           ELSE 0
                      END AS bit) AS con_derecho
        ) AS isr_tax
        CROSS APPLY (
          SELECT CAST(CASE WHEN isr_tax.con_derecho = 1
                             THEN ROUND(@isr_subsidy_amount * pe.[dias] / @isr_subsidy_factor, 2)
                           WHEN isr_tax.con_derecho = 0 THEN 0
                      END AS decimal(12,2)) AS subsidio_causado
        ) AS isr_subsidy
        CROSS APPLY (
          SELECT CASE WHEN isr_subsidy.subsidio_causado < isr_tax.causado
                      THEN isr_subsidy.subsidio_causado ELSE isr_tax.causado END AS aplicado
        ) AS isr_applied`;

/** Valor de la columna solo si el renglón queda calculado ('C'); en 'N' solo se llenan estado, motivo y base. */
function whenCalculated(expression: string): string {
  return `CASE WHEN isr_skip.motivo IS NULL THEN ${expression} END`;
}

/**
 * Las 18 columnas del desglose del ISR, con su expresión sobre `ISR_PARAMETERS_SQL` e `ISR_BRACKET_APPLY_SQL`.
 * Cumplen `CK_period_employees_isr`: en 'N' todo va NULL salvo estado, motivo y base; en 'C' la base 0 deja el tramo
 * en NULL e ISR, subsidio aplicado y retenido en 0.
 */
export const ISR_COLUMNS_SQL = [
  { column: "isr_estado",                    expression: "CASE WHEN isr_skip.motivo IS NULL THEN 'C' ELSE 'N' END" },
  { column: "isr_motivo",                    expression: "isr_skip.motivo" },
  { column: "isr_base_gravable",             expression: "pe.[importe_salario]" },
  { column: "isr_ejercicio_tarifa",          expression: whenCalculated("@isr_fiscal_year") },
  { column: "isr_limite_inferior",           expression: whenCalculated("isr_bracket.[limite_inferior]") },
  { column: "isr_cuota_fija",                expression: whenCalculated("isr_bracket.[cuota_fija]") },
  { column: "isr_porcentaje_excedente",      expression: whenCalculated("isr_bracket.[porcentaje_excedente]") },
  { column: "isr_causado",                   expression: "isr_tax.causado" },
  { column: "subsidio_monto_mensual",        expression: whenCalculated("@isr_subsidy_amount") },
  { column: "subsidio_monto_vigente_desde",  expression: whenCalculated("@isr_subsidy_amount_since") },
  { column: "subsidio_tope_ingreso_mensual", expression: whenCalculated("@isr_subsidy_cap") },
  { column: "subsidio_tope_vigente_desde",   expression: whenCalculated("@isr_subsidy_cap_since") },
  { column: "subsidio_factor_dias_mes",      expression: whenCalculated("@isr_subsidy_factor") },
  { column: "subsidio_factor_vigente_desde", expression: whenCalculated("@isr_subsidy_factor_since") },
  { column: "subsidio_con_derecho",          expression: "isr_tax.con_derecho" },
  { column: "subsidio_causado",              expression: "isr_subsidy.subsidio_causado" },
  { column: "subsidio_aplicado",             expression: "isr_applied.aplicado" },
  { column: "isr_retenido",                  expression: "isr_tax.causado - isr_applied.aplicado" },
] as const;

/** Lista `columna = expresión` para el SET del UPDATE que llena el desglose. */
export const ISR_UPDATE_SET_SQL = ISR_COLUMNS_SQL.map(({ column, expression }) => `[${column}] = ${expression}`).join(
  ",\n              ",
);
