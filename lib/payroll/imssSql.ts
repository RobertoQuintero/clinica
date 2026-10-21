import "server-only";

import type { IImssBreakdown } from "@/interfaces/payroll_imss";
import { IMSS_CONTRIBUTION_REGIME } from "@/lib/payroll/constants";

/**
 * Fragmentos SQL de la cuota obrera del IMSS de la nómina fiscal (spec 91), compartidos por `calculatePayrollPeriod`
 * y por el aviso "Recalcula" (`imssRecalculation.ts`). lib/payroll/imssCalculation.ts los espeja para las pruebas y,
 * si divergen, manda este SQL.
 *
 * `IMSS_PARAMETERS_SQL` declara y resuelve las variables `@imss_*` (UMA, salario mínimo y las 7 claves IMSS vigentes a
 * `@fecha_fin`); se pega en el batch antes de las sentencias que usan `IMSS_APPLY_SQL`. Este último se pega en el FROM
 * de una sentencia sobre `[payroll].[period_employees] pe` (ya con `dias`, `dias_falta`, `isr_retenido` y las
 * percepciones calculados) y deja los alias `imss_state`, `imss_amounts`, `imss_total` e `imss_result`.
 * `IMSS_COLUMNS_SQL` lista las columnas del desglose con su expresión sobre esos dos fragmentos.
 *
 * Solo se aplica a renglones 'F' de periodos ordinarios y después del ISR. El régimen y el NSS se leen de
 * `RH.empleados` al calcular; no se congelan.
 */

// Variable, columna de tax_parameters y variable con su `vigente_desde`.
const IMSS_PARAMETER_VARIABLES = [
  { key: "UMA_DIARIA",                  value: "@imss_uma",             since: "@imss_uma_since" },
  { key: "SALARIO_MINIMO_GENERAL",      value: "@imss_minimum_wage",    since: "@imss_minimum_wage_since" },
  { key: "IMSS_OBRERO_EYM_EXCEDENTE",   value: "@imss_rate_excess",     since: "@imss_rate_excess_since" },
  { key: "IMSS_OBRERO_EYM_DINERO",      value: "@imss_rate_cash",       since: "@imss_rate_cash_since" },
  { key: "IMSS_OBRERO_EYM_PENSIONADOS", value: "@imss_rate_pensioners", since: "@imss_rate_pensioners_since" },
  { key: "IMSS_OBRERO_IV",              value: "@imss_rate_disability", since: "@imss_rate_disability_since" },
  { key: "IMSS_OBRERO_CEAV",            value: "@imss_rate_retirement", since: "@imss_rate_retirement_since" },
  { key: "IMSS_UMBRAL_EXCEDENTE_UMAS",  value: "@imss_threshold_umas",  since: "@imss_threshold_umas_since" },
  { key: "IMSS_TOPE_SBC_UMAS",          value: "@imss_cap_umas",        since: "@imss_cap_umas_since" },
] as const;

const IMSS_RATE_AND_LIMIT_VARIABLES = IMSS_PARAMETER_VARIABLES.filter(
  ({ key }) => key !== "UMA_DIARIA" && key !== "SALARIO_MINIMO_GENERAL",
);

/**
 * UMA, salario mínimo y las 7 claves IMSS vigentes a fecha_fin, con su `vigente_desde`: la fila más reciente con
 * `vigente_desde <= fecha_fin`. Sin fila, la variable queda NULL. `@imss_parameters_since` es el `vigente_desde`
 * más reciente de las 7 claves IMSS (NULL si falta alguna).
 */
export const IMSS_PARAMETERS_SQL = `
       -- Spec 91: UMA, salario mínimo y tasas/límites del IMSS vigentes a fecha_fin.
       DECLARE ${IMSS_PARAMETER_VARIABLES.map(
         ({ value, since }) => `${value} decimal(18,4), ${since} date`,
       ).join(",\n               ")};
       ${IMSS_PARAMETER_VARIABLES.map(
         ({ key, value, since }) => `SELECT TOP 1 ${value} = [valor], ${since} = [vigente_desde]
         FROM [CentroPodologico].[payroll].[tax_parameters]
        WHERE [clave] = '${key}' AND [vigente_desde] <= @fecha_fin
        ORDER BY [vigente_desde] DESC;`,
       ).join("\n       ")}
       DECLARE @imss_parameters_since date = CASE
         WHEN ${IMSS_RATE_AND_LIMIT_VARIABLES.map(({ since }) => `${since} IS NOT NULL`).join("\n          AND ")}
         THEN (SELECT MAX(v) FROM (VALUES ${IMSS_RATE_AND_LIMIT_VARIABLES.map(({ since }) => `(${since})`).join(", ")}) AS t(v))
       END;`;

/**
 * Cálculo por renglón:
 * - `imss_emp` / `imss_sbc`: régimen y NSS del empleado, y su SBC vigente a fecha_fin (el de `vigente_desde` más reciente).
 * - `imss_state`: 'X' si el régimen no es el 02; si es 02, 'N' con el primer motivo que aplique (NSS, SBC, UMA,
 *   7 claves IMSS, salario mínimo) o 'C'.
 * - `imss_base`: tope del SBC y umbral del excedente = ROUND(UMAs × UMA, 2); SBC topado = min(SBC, tope);
 *   excedente diario = max(0, SBC topado − umbral).
 * - `imss_amounts`: cuota de cada ramo = ROUND(base diaria × días × tasa / 100, 2). EyM usa `dias + dias_falta`;
 *   IV y CEAV usan `dias`. La multiplicación se hace en escala 6 antes de dividir entre 100 para no truncar.
 * - `imss_total`: cuota causada = suma de los 5 importes redondeados.
 * - `imss_net`: tope al neto = max(0, percepciones del renglón − ISR retenido (0 si no está calculado)).
 * - `imss_result`: exento por salario mínimo (art. 36: `salario_diario <=` mínimo) y retenido = 0 si exento,
 *   si no min(causada, tope al neto).
 */
export const IMSS_APPLY_SQL = `
        -- Spec 91: régimen, NSS y SBC vigente a fecha_fin.
        OUTER APPLY (
          SELECT e.[tipo_regimen], e.[nss]
            FROM [CentroPodologico].[RH].[empleados] e
           WHERE e.[id_empleado] = pe.[id_empleado]
        ) AS imss_emp
        OUTER APPLY (
          SELECT TOP 1 s.[sbc], s.[vigente_desde]
            FROM [CentroPodologico].[RH].[employee_sbc] s
           WHERE s.[id_empleado] = pe.[id_empleado] AND s.[vigente_desde] <= @fecha_fin
           ORDER BY s.[vigente_desde] DESC
        ) AS imss_sbc
        CROSS APPLY (
          SELECT CAST(CASE WHEN ISNULL(imss_emp.[tipo_regimen], '') <> '${IMSS_CONTRIBUTION_REGIME}' THEN 'X'
                           WHEN LTRIM(RTRIM(ISNULL(imss_emp.[nss], ''))) = '' THEN 'N'
                           WHEN imss_sbc.[sbc] IS NULL THEN 'N'
                           WHEN @imss_uma IS NULL THEN 'N'
                           WHEN @imss_parameters_since IS NULL THEN 'N'
                           WHEN @imss_minimum_wage IS NULL THEN 'N'
                           ELSE 'C' END AS char(1)) AS estado,
                 CAST(CASE WHEN ISNULL(imss_emp.[tipo_regimen], '') <> '${IMSS_CONTRIBUTION_REGIME}' THEN NULL
                           WHEN LTRIM(RTRIM(ISNULL(imss_emp.[nss], ''))) = '' THEN 'missing_nss'
                           WHEN imss_sbc.[sbc] IS NULL THEN 'missing_sbc'
                           WHEN @imss_uma IS NULL THEN 'missing_uma'
                           WHEN @imss_parameters_since IS NULL THEN 'missing_imss_parameters'
                           WHEN @imss_minimum_wage IS NULL THEN 'missing_minimum_wage'
                      END AS varchar(30)) AS motivo
        ) AS imss_state
        CROSS APPLY (
          SELECT CAST(ROUND(@imss_cap_umas * @imss_uma, 2) AS decimal(12,2))       AS tope_sbc,
                 CAST(ROUND(@imss_threshold_umas * @imss_uma, 2) AS decimal(12,2)) AS umbral_excedente
        ) AS imss_limits
        CROSS APPLY (
          SELECT CAST(CASE WHEN imss_sbc.[sbc] < imss_limits.tope_sbc THEN imss_sbc.[sbc] ELSE imss_limits.tope_sbc END
                      AS decimal(12,2)) AS sbc_topado
        ) AS imss_capped
        CROSS APPLY (
          SELECT CAST(CASE WHEN imss_capped.sbc_topado > imss_limits.umbral_excedente
                           THEN imss_capped.sbc_topado - imss_limits.umbral_excedente ELSE 0 END
                      AS decimal(12,2)) AS excedente_diario,
                 pe.[dias] + pe.[dias_falta] AS dias_eym,
                 pe.[dias]                   AS dias_iv_ceav
        ) AS imss_base
        CROSS APPLY (
          SELECT CAST(ROUND(CAST(imss_base.excedente_diario * imss_base.dias_eym * @imss_rate_excess AS decimal(30,6)) / 100, 2)
                      AS decimal(12,2)) AS eym_excedente,
                 CAST(ROUND(CAST(imss_capped.sbc_topado * imss_base.dias_eym * @imss_rate_cash AS decimal(30,6)) / 100, 2)
                      AS decimal(12,2)) AS eym_dinero,
                 CAST(ROUND(CAST(imss_capped.sbc_topado * imss_base.dias_eym * @imss_rate_pensioners AS decimal(30,6)) / 100, 2)
                      AS decimal(12,2)) AS eym_pensionados,
                 CAST(ROUND(CAST(imss_capped.sbc_topado * imss_base.dias_iv_ceav * @imss_rate_disability AS decimal(30,6)) / 100, 2)
                      AS decimal(12,2)) AS iv,
                 CAST(ROUND(CAST(imss_capped.sbc_topado * imss_base.dias_iv_ceav * @imss_rate_retirement AS decimal(30,6)) / 100, 2)
                      AS decimal(12,2)) AS ceav
        ) AS imss_amounts
        CROSS APPLY (
          SELECT CAST(imss_amounts.eym_excedente + imss_amounts.eym_dinero + imss_amounts.eym_pensionados
                      + imss_amounts.iv + imss_amounts.ceav AS decimal(12,2)) AS cuota_causada
        ) AS imss_total
        CROSS APPLY (
          SELECT CAST(ISNULL(SUM(pep.[importe]), 0) AS decimal(12,2)) AS percepciones
            FROM [CentroPodologico].[payroll].[period_employee_perceptions] pep
           WHERE pep.[id_period_employee] = pe.[id_period_employee]
        ) AS imss_perceptions
        CROSS APPLY (
          SELECT CAST(CASE WHEN imss_perceptions.percepciones - ISNULL(pe.[isr_retenido], 0) > 0
                           THEN imss_perceptions.percepciones - ISNULL(pe.[isr_retenido], 0) ELSE 0 END
                      AS decimal(12,2)) AS tope_neto
        ) AS imss_net
        CROSS APPLY (
          SELECT CAST(CASE WHEN pe.[salario_diario] <= @imss_minimum_wage THEN 1 ELSE 0 END AS bit) AS exento
        ) AS imss_exemption
        CROSS APPLY (
          SELECT CAST(CASE WHEN imss_exemption.exento = 1 THEN 0
                           WHEN imss_total.cuota_causada > imss_net.tope_neto THEN imss_net.tope_neto
                           ELSE imss_total.cuota_causada END AS decimal(12,2)) AS retenido,
                 CAST(CASE WHEN imss_exemption.exento = 0 AND imss_total.cuota_causada > imss_net.tope_neto
                           THEN 1 ELSE 0 END AS bit) AS topado_al_neto
        ) AS imss_result`;

/**
 * Las columnas de `payroll.period_employee_imss` (menos `id_period_employee`) con su expresión sobre
 * `IMSS_PARAMETERS_SQL` e `IMSS_APPLY_SQL`. Solo se insertan los renglones con `imss_state.estado = 'C'`, donde
 * todo es NOT NULL; cumplen `CK_period_employee_imss`.
 */
export const IMSS_COLUMNS_SQL = [
  { column: "sbc",                          expression: "imss_sbc.[sbc]" },
  { column: "sbc_vigente_desde",            expression: "imss_sbc.[vigente_desde]" },
  { column: "uma_diaria",                   expression: "@imss_uma" },
  { column: "uma_vigente_desde",            expression: "@imss_uma_since" },
  { column: "salario_minimo",               expression: "@imss_minimum_wage" },
  { column: "salario_minimo_vigente_desde", expression: "@imss_minimum_wage_since" },
  { column: "parametros_vigente_desde",     expression: "@imss_parameters_since" },
  { column: "tope_sbc_umas",                expression: "@imss_cap_umas" },
  { column: "umbral_excedente_umas",        expression: "@imss_threshold_umas" },
  { column: "tope_sbc",                     expression: "imss_limits.tope_sbc" },
  { column: "sbc_topado",                   expression: "imss_capped.sbc_topado" },
  { column: "umbral_excedente",             expression: "imss_limits.umbral_excedente" },
  { column: "excedente_diario",             expression: "imss_base.excedente_diario" },
  { column: "dias_eym",                     expression: "imss_base.dias_eym" },
  { column: "dias_iv_ceav",                 expression: "imss_base.dias_iv_ceav" },
  { column: "tasa_eym_excedente",           expression: "@imss_rate_excess" },
  { column: "importe_eym_excedente",        expression: "imss_amounts.eym_excedente" },
  { column: "tasa_eym_dinero",              expression: "@imss_rate_cash" },
  { column: "importe_eym_dinero",           expression: "imss_amounts.eym_dinero" },
  { column: "tasa_eym_pensionados",         expression: "@imss_rate_pensioners" },
  { column: "importe_eym_pensionados",      expression: "imss_amounts.eym_pensionados" },
  { column: "tasa_iv",                      expression: "@imss_rate_disability" },
  { column: "importe_iv",                   expression: "imss_amounts.iv" },
  { column: "tasa_ceav",                    expression: "@imss_rate_retirement" },
  { column: "importe_ceav",                 expression: "imss_amounts.ceav" },
  { column: "cuota_causada",                expression: "imss_total.cuota_causada" },
  { column: "exento_salario_minimo",        expression: "imss_exemption.exento" },
  { column: "tope_neto",                    expression: "imss_net.tope_neto" },
  { column: "topado_al_neto",               expression: "imss_result.topado_al_neto" },
  { column: "imss_retenido",                expression: "imss_result.retenido" },
] as const;

/** `[columna]` separadas por coma para el INSERT del desglose. */
export const IMSS_INSERT_COLUMNS_SQL = IMSS_COLUMNS_SQL.map(({ column }) => `[${column}]`).join(", ");

/** Expresiones del SELECT del desglose, en el mismo orden que `IMSS_INSERT_COLUMNS_SQL`. */
export const IMSS_SELECT_SQL = IMSS_COLUMNS_SQL.map(({ expression }) => expression).join(",\n              ");

/**
 * SET del UPDATE de `payroll.period_employees`: estado, motivo (solo 'N') y total retenido (solo 'C').
 * Cumple `CK_period_employees_imss`.
 */
export const IMSS_UPDATE_SET_SQL = `[imss_estado]   = imss_state.estado,
              [imss_motivo]   = imss_state.motivo,
              [imss_retenido] = CASE WHEN imss_state.estado = 'C' THEN imss_result.retenido END`;

const IMSS_BREAKDOWN_DATE_COLUMNS = [
  "sbc_vigente_desde",
  "uma_vigente_desde",
  "salario_minimo_vigente_desde",
  "parametros_vigente_desde",
] as const;
const IMSS_BREAKDOWN_BIT_COLUMNS = ["exento_salario_minimo", "topado_al_neto"] as const;

/** SELECT del desglose congelado (`payroll.period_employee_imss`, alias `i`): fechas como texto y decimales como float. */
export const IMSS_BREAKDOWN_SELECT_SQL = IMSS_COLUMNS_SQL.map(({ column }) => {
  if ((IMSS_BREAKDOWN_DATE_COLUMNS as readonly string[]).includes(column)) {
    return `CONVERT(varchar(10), i.[${column}], 120) AS [${column}]`;
  }
  if ((IMSS_BREAKDOWN_BIT_COLUMNS as readonly string[]).includes(column)) return `i.[${column}]`;
  return `CAST(i.[${column}] AS float) AS [${column}]`;
}).join(",\n                    ");

/** Fila de `IMSS_BREAKDOWN_SELECT_SQL` a `IImssBreakdown`: fechas como texto, bits como boolean y el resto como número. */
export function toImssBreakdown(row: Record<string, unknown>): IImssBreakdown {
  const breakdown: Record<string, string | number | boolean> = {};
  for (const { column } of IMSS_COLUMNS_SQL) {
    const value = row[column];
    if ((IMSS_BREAKDOWN_DATE_COLUMNS as readonly string[]).includes(column)) breakdown[column] = String(value);
    else if ((IMSS_BREAKDOWN_BIT_COLUMNS as readonly string[]).includes(column)) breakdown[column] = Boolean(value);
    else breakdown[column] = Number(value);
  }
  return breakdown as unknown as IImssBreakdown;
}
