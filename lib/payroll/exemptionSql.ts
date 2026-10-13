import "server-only";

import type { ExemptionSkipReason } from "@/interfaces/payroll_exemption";

/**
 * Fragmentos SQL del motor de gravado/exento de la nómina fiscal (spec 73), compartidos por
 * `calculatePayrollPeriod` y por el aviso "Recalcula" (`exemptionRecalculation.ts`).
 * lib/payroll/exemptionCalculation.ts los espeja y, si divergen, manda este SQL.
 *
 * `EXEMPTION_PARAMETERS_SQL` declara las variables `@exemption_*`; necesita @id_payment_period y @fecha_fin y se
 * pega en el batch antes de la sentencia que usa `EXEMPTION_APPLY_SQL`. Este último necesita además @id_period y
 * se pega en el FROM de una sentencia con tres alias:
 * - `fl`: la línea de percepción, con `id_period_employee`, `id_perception`, `importe` y `eventos`;
 * - `pe`: su `[payroll].[period_employees]` (con `id_empleado` y `dias`);
 * - `exemption_rule`: su fila de `[payroll].[perceptions]` (la regla vigente del catálogo).
 * `EXEMPTION_COLUMNS_SQL` lista las columnas del renglón con su expresión sobre esos fragmentos.
 *
 * El motor es genérico: solo lee `tipo_limite_exencion`, `porcentaje_exento`, `umas_limite` y
 * `periodicidad_limite`. Ninguna rama sabe de qué concepto se trata.
 */

function skipReasonLiteral(reason: ExemptionSkipReason): string {
  return `'${reason}'`;
}

/**
 * UMA diaria vigente a fecha_fin con su `vigente_desde` (la fila más reciente con `vigente_desde <= fecha_fin`;
 * sin fila, NULL) y si la frecuencia del periodo es semanal (`clave_sat = '02'`, nunca un id fijo).
 */
export const EXEMPTION_PARAMETERS_SQL = `
       -- Spec 73: UMA diaria vigente a fecha_fin y si la frecuencia del periodo es semanal.
       DECLARE @exemption_uma_daily decimal(18,4), @exemption_uma_daily_since date, @exemption_is_weekly bit;
       SELECT TOP 1 @exemption_uma_daily = [valor], @exemption_uma_daily_since = [vigente_desde]
         FROM [CentroPodologico].[payroll].[tax_parameters]
        WHERE [clave] = 'UMA_DIARIA' AND [vigente_desde] <= @fecha_fin
        ORDER BY [vigente_desde] DESC;
       SELECT @exemption_is_weekly = CASE WHEN EXISTS (
                SELECT 1 FROM [CentroPodologico].[RH].[payment_periods] pp
                 WHERE pp.[id_payment_period] = @id_payment_period AND pp.[clave_sat] = '02'
              ) THEN 1 ELSE 0 END;`;

/**
 * Desglose por línea:
 * - `exemption_limited`: la regla usa tope en UMA ('U' o 'M').
 * - `exemption_skip`: motivo de "No calculado", en orden: sin UMA, frecuencia no semanal con periodicidad 'S'.
 *   NULL si se calcula. 'N', 'T' y 'P' no usan la UMA ni la frecuencia: siempre se calculan.
 * - `exemption_cap`: tope de la ventana = ROUND(umas × UMA × multiplicador, 2); el multiplicador es `eventos` en
 *   'E', los días pagados en 'D' y 1 en 'S', 'M' y 'A'. Se multiplica antes de redondear.
 * - `exemption_previous`: exento ya consumido por la misma percepción y empleado en renglones 'F' calculados de
 *   OTROS periodos anteriores (fecha_fin menor o, si es igual, id_period menor) del mismo año de fecha_fin (y del
 *   mismo mes en 'M'). Solo en periodicidad 'A' y 'M'; en el resto 0. No filtra por sucursal ni frecuencia.
 * - `exemption_left` y `exemption_exempt`: tope restante y exento. El gravado es la resta (ver
 *   `EXEMPTION_COLUMNS_SQL`), nunca se redondea por separado.
 */
export const EXEMPTION_APPLY_SQL = `
        -- Spec 73: motivo, tope, acumulado previo, exento y gravado de la línea de percepción.
        CROSS APPLY (
          SELECT CAST(CASE WHEN exemption_rule.[tipo_limite_exencion] IN ('U','M') THEN 1 ELSE 0 END AS bit) AS limited
        ) AS exemption_limited
        CROSS APPLY (
          SELECT CAST(CASE WHEN exemption_limited.limited = 1 AND @exemption_uma_daily IS NULL
                             THEN ${skipReasonLiteral("missing_uma")}
                           WHEN exemption_limited.limited = 1 AND exemption_rule.[periodicidad_limite] = 'S'
                                AND @exemption_is_weekly = 0
                             THEN ${skipReasonLiteral("unsupported_frequency")}
                      END AS varchar(30)) AS motivo
        ) AS exemption_skip
        CROSS APPLY (
          SELECT CAST(CASE WHEN exemption_limited.limited = 1 AND exemption_skip.motivo IS NULL
                             THEN ROUND(exemption_rule.[umas_limite] * @exemption_uma_daily
                                        * CASE exemption_rule.[periodicidad_limite]
                                            WHEN 'E' THEN fl.[eventos]
                                            WHEN 'D' THEN pe.[dias]
                                            ELSE 1 END, 2)
                      END AS decimal(12,2)) AS tope
        ) AS exemption_cap
        CROSS APPLY (
          SELECT CAST(CASE WHEN exemption_cap.tope IS NULL THEN NULL
                           WHEN exemption_rule.[periodicidad_limite] IN ('A','M') THEN ISNULL((
                             SELECT SUM(prev.[importe_exento])
                               FROM [CentroPodologico].[payroll].[period_employee_perceptions] prev
                               JOIN [CentroPodologico].[payroll].[period_employees] prev_pe
                                 ON prev_pe.[id_period_employee] = prev.[id_period_employee]
                               JOIN [CentroPodologico].[payroll].[periods] prev_period
                                 ON prev_period.[id_period] = prev_pe.[id_period]
                              WHERE prev.[id_perception] = fl.[id_perception]
                                AND prev.[exencion_estado] = 'C'
                                AND prev_pe.[id_empleado] = pe.[id_empleado]
                                AND prev_period.[id_period] <> @id_period
                                AND YEAR(prev_period.[fecha_fin]) = YEAR(@fecha_fin)
                                AND (exemption_rule.[periodicidad_limite] = 'A'
                                     OR MONTH(prev_period.[fecha_fin]) = MONTH(@fecha_fin))
                                AND (prev_period.[fecha_fin] < @fecha_fin
                                     OR (prev_period.[fecha_fin] = @fecha_fin AND prev_period.[id_period] < @id_period))
                           ), 0)
                           ELSE 0
                      END AS decimal(12,2)) AS consumido
        ) AS exemption_previous
        CROSS APPLY (
          SELECT CASE WHEN exemption_cap.tope IS NULL THEN NULL
                      WHEN exemption_cap.tope - exemption_previous.consumido > 0
                        THEN exemption_cap.tope - exemption_previous.consumido
                      ELSE 0 END AS restante,
                 ROUND(fl.[importe] * exemption_rule.[porcentaje_exento] / 100, 2) AS por_porcentaje
        ) AS exemption_left
        CROSS APPLY (
          SELECT CAST(CASE WHEN exemption_skip.motivo IS NOT NULL THEN NULL
                           WHEN exemption_rule.[tipo_limite_exencion] = 'N' THEN 0
                           WHEN exemption_rule.[tipo_limite_exencion] = 'T' THEN fl.[importe]
                           WHEN exemption_rule.[tipo_limite_exencion] = 'P' THEN exemption_left.por_porcentaje
                           WHEN exemption_rule.[tipo_limite_exencion] = 'U'
                             THEN CASE WHEN fl.[importe] < exemption_left.restante
                                       THEN fl.[importe] ELSE exemption_left.restante END
                           WHEN exemption_rule.[tipo_limite_exencion] = 'M'
                             THEN CASE WHEN exemption_left.por_porcentaje < exemption_left.restante
                                       THEN exemption_left.por_porcentaje ELSE exemption_left.restante END
                      END AS decimal(12,2)) AS exento
        ) AS exemption_exempt`;

/** Valor de la columna solo en las reglas con tope ('U' y 'M') ya calculadas. */
function whenLimitedAndCalculated(expression: string): string {
  return `CASE WHEN exemption_limited.limited = 1 AND exemption_skip.motivo IS NULL THEN ${expression} END`;
}

/**
 * Columnas del renglón de percepción con su expresión sobre `EXEMPTION_APPLY_SQL`. Cumplen
 * `CK_period_employee_perceptions_*`: la regla se copia tal cual del catálogo (que ya cumple la misma forma), el
 * tope, la UMA y el acumulado solo van en 'U' y 'M' calculados, y en 'N' gravado y exento van NULL.
 */
export const EXEMPTION_COLUMNS_SQL = [
  { column: "id_period_employee",      expression: "fl.[id_period_employee]" },
  { column: "id_perception",           expression: "fl.[id_perception]" },
  { column: "importe",                 expression: "fl.[importe]" },
  { column: "eventos",                 expression: "CASE WHEN exemption_rule.[periodicidad_limite] = 'E' THEN fl.[eventos] END" },
  { column: "exencion_estado",         expression: "CAST(CASE WHEN exemption_skip.motivo IS NULL THEN 'C' ELSE 'N' END AS char(1))" },
  { column: "exencion_motivo",         expression: "exemption_skip.motivo" },
  { column: "tipo_limite_exencion",    expression: "exemption_rule.[tipo_limite_exencion]" },
  { column: "umas_limite",             expression: "exemption_rule.[umas_limite]" },
  { column: "porcentaje_exento",       expression: "exemption_rule.[porcentaje_exento]" },
  { column: "periodicidad_limite",     expression: "exemption_rule.[periodicidad_limite]" },
  { column: "uma_diaria",              expression: whenLimitedAndCalculated("@exemption_uma_daily") },
  { column: "uma_vigente_desde",       expression: whenLimitedAndCalculated("@exemption_uma_daily_since") },
  { column: "tope_exento",             expression: "exemption_cap.tope" },
  { column: "exento_consumido_previo", expression: "exemption_previous.consumido" },
  { column: "importe_exento",          expression: "exemption_exempt.exento" },
  { column: "importe_gravado",         expression: "CASE WHEN exemption_skip.motivo IS NULL THEN fl.[importe] - exemption_exempt.exento END" },
] as const;

/** Lista de columnas y de expresiones para el `INSERT … SELECT` de los renglones. */
export const EXEMPTION_INSERT_COLUMNS_SQL = EXEMPTION_COLUMNS_SQL.map(({ column }) => `[${column}]`).join(", ");
export const EXEMPTION_SELECT_SQL = EXEMPTION_COLUMNS_SQL.map(({ expression }) => expression).join(",\n              ");
