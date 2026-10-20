import "server-only";

import type { ITransactionClient } from "@/database/connection";
import type { IPtuAddableEmployee, IPtuDistribution, IPtuHistoryEntry, IPtuHistoryYear, PtuCategory } from "@/interfaces/payroll_ptu";
import { PTU_AVERAGE_YEARS } from "@/lib/payroll/constants";
import { EMPLOYEE_FULL_NAME_SQL } from "@/lib/payroll/employeeName";

/** Columnas de payroll.ptu_distributions; las fechas salen como string (nunca Date). */
export const PTU_DISTRIBUTION_SELECT = `
  d.id_ptu_distribution, d.id_empresa, d.ejercicio, d.tipo_persona,
  d.renta_gravable, d.ptu_no_cobrada_anterior, d.factor_tres_meses, d.estado,
  d.fondo, d.mitad_dias, d.mitad_salario, d.total_dias, d.total_salario_reparto,
  d.tope_salario_diario_confianza, d.total_repartido, d.remanente_topes, d.remanente_redondeo,
  d.created_by,
  CONVERT(varchar(19), d.created_at, 120) AS created_at,
  CONVERT(varchar(19), d.updated_at, 120) AS updated_at,
  d.cerrado_by,
  CONVERT(varchar(19), d.cerrado_at, 120) AS cerrado_at`;

/** Los tres ejercicios anteriores al del reparto, del más reciente al más antiguo. */
export function getPtuAverageYears(ejercicio: number): number[] {
  return Array.from({ length: PTU_AVERAGE_YEARS }, (_, index) => ejercicio - 1 - index);
}

/** Ejercicios, entre los tres anteriores al del reparto, que ya tienen un reparto cerrado de la empresa. */
export async function loadPtuClosedDistributionYears(
  client: ITransactionClient,
  distribution: Pick<IPtuDistribution, "id_empresa" | "ejercicio">,
): Promise<Set<number>> {
  const years = getPtuAverageYears(distribution.ejercicio);
  const yearParams = Object.fromEntries(years.map((year, index) => [`year${index}`, year]));
  const yearPlaceholders = years.map((_, index) => `@year${index}`).join(", ");
  const rows = (await client.queryParams(
    `SELECT ejercicio
       FROM [CentroPodologico].[payroll].[ptu_distributions]
      WHERE id_empresa = @id_empresa AND estado = 'C' AND ejercicio IN (${yearPlaceholders})`,
    { id_empresa: distribution.id_empresa, ...yearParams },
  )) as { ejercicio: number }[];
  return new Set(rows.map((row) => row.ejercicio));
}

/**
 * PTU de los tres ejercicios anteriores de cada trabajador del reparto, con su origen. Por año gana
 * el reparto cerrado de la empresa (su `ptu_final`) y la captura manual de ese año se ignora; sin
 * reparto cerrado, vale `ptu_history`. Un año sin ninguno de los dos no aparece.
 */
export async function loadPtuHistoryByEmployee(
  client: ITransactionClient,
  distribution: Pick<IPtuDistribution, "id_ptu_distribution" | "id_empresa" | "ejercicio">,
): Promise<Map<number, IPtuHistoryEntry[]>> {
  const years = getPtuAverageYears(distribution.ejercicio);
  const yearParams = Object.fromEntries(years.map((year, index) => [`year${index}`, year]));
  const yearPlaceholders = years.map((_, index) => `@year${index}`).join(", ");

  const closedRows = (await client.queryParams(
    `SELECT d.ejercicio, e.id_empleado, e.ptu_final
       FROM [CentroPodologico].[payroll].[ptu_distributions] d
       JOIN [CentroPodologico].[payroll].[ptu_distribution_employees] e
         ON e.id_ptu_distribution = d.id_ptu_distribution
      WHERE d.id_empresa = @id_empresa
        AND d.estado = 'C'
        AND d.ejercicio IN (${yearPlaceholders})
        AND e.id_empleado IN (
              SELECT id_empleado FROM [CentroPodologico].[payroll].[ptu_distribution_employees]
               WHERE id_ptu_distribution = @id_ptu_distribution)`,
    { id_empresa: distribution.id_empresa, id_ptu_distribution: distribution.id_ptu_distribution, ...yearParams },
  )) as { ejercicio: number; id_empleado: number; ptu_final: number }[];

  const yearsWithClosedDistribution = await loadPtuClosedDistributionYears(client, distribution);

  const manualRows = (await client.queryParams(
    `SELECT h.ejercicio, h.id_empleado, h.importe
       FROM [CentroPodologico].[payroll].[ptu_history] h
      WHERE h.ejercicio IN (${yearPlaceholders})
        AND h.id_empleado IN (
              SELECT id_empleado FROM [CentroPodologico].[payroll].[ptu_distribution_employees]
               WHERE id_ptu_distribution = @id_ptu_distribution)`,
    { id_ptu_distribution: distribution.id_ptu_distribution, ...yearParams },
  )) as { ejercicio: number; id_empleado: number; importe: number }[];

  const historyByEmployee = new Map<number, IPtuHistoryEntry[]>();
  const addEntry = (id_empleado: number, entry: IPtuHistoryEntry) => {
    const entries = historyByEmployee.get(id_empleado);
    if (entries) entries.push(entry);
    else historyByEmployee.set(id_empleado, [entry]);
  };
  for (const row of closedRows) {
    addEntry(row.id_empleado, { ejercicio: row.ejercicio, importe: Number(row.ptu_final), origen: "reparto" });
  }
  for (const row of manualRows) {
    if (yearsWithClosedDistribution.has(row.ejercicio)) continue;
    addEntry(row.id_empleado, { ejercicio: row.ejercicio, importe: Number(row.importe), origen: "manual" });
  }
  return historyByEmployee;
}

/**
 * Los tres ejercicios anteriores de un trabajador, del más reciente al más antiguo, con el importe y su
 * origen. `closedDistribution` marca los años que vienen de un reparto cerrado: ahí la captura manual no
 * aplica, aunque el trabajador no tenga renglón en ese reparto.
 */
export async function loadPtuHistoryYears(
  client: ITransactionClient,
  distribution: Pick<IPtuDistribution, "id_ptu_distribution" | "id_empresa" | "ejercicio">,
  id_empleado: number,
): Promise<IPtuHistoryYear[]> {
  // En serie: un cliente atado a una transacción no admite dos consultas a la vez.
  const historyByEmployee = await loadPtuHistoryByEmployee(client, distribution);
  const closedYears = await loadPtuClosedDistributionYears(client, distribution);
  const entries = historyByEmployee.get(id_empleado) ?? [];
  return getPtuAverageYears(distribution.ejercicio).map((ejercicio) => {
    const entry = entries.find((candidate) => candidate.ejercicio === ejercicio);
    return {
      ejercicio,
      importe: entry ? entry.importe : null,
      origen: entry ? entry.origen : null,
      closedDistribution: closedYears.has(ejercicio),
    };
  });
}

/** Trabajador que la precarga propone para un reparto, con los datos actuales del empleado. */
export interface IPtuPreloadRow {
  id_empleado:         number;
  id_sucursal:         number;
  categoria_ptu:       PtuCategory;
  tipo_contrato:       string | null;
  dias:                number;
  salario:             number;
  salario_diario_tope: number;
}

/** Tope de días de un trabajador en el ejercicio (columna `dias` smallint con CHECK 0..366). */
const MAX_PRELOAD_DAYS = 366;

/**
 * Trabajadores de la empresa con al menos una fila fiscal ('F') de un periodo ordinario ('O') cuyo
 * `fecha_fin` cae en el ejercicio, activos o dados de baja. Los periodos extraordinarios (aguinaldo)
 * no suman. Días y salario son la suma de `dias` e `importe_salario` (solo sueldo: sin horas extra,
 * bonos, comisiones, aguinaldo, prima ni vacaciones pagadas); el salario diario tope es el de la
 * fila fiscal más reciente. La empresa del empleado es la de su sucursal actual.
 */
export async function loadPtuPreloadRows(
  client: ITransactionClient,
  id_empresa: number,
  ejercicio: number,
): Promise<IPtuPreloadRow[]> {
  const rows = (await client.queryParams(
    `WITH fiscal_rows AS (
       SELECT pe.id_empleado, pe.dias, pe.importe_salario, pe.salario_diario,
              ROW_NUMBER() OVER (PARTITION BY pe.id_empleado ORDER BY p.fecha_fin DESC, p.id_period DESC) AS recency
         FROM [CentroPodologico].[payroll].[period_employees] pe
         JOIN [CentroPodologico].[payroll].[periods] p ON p.id_period = pe.id_period
         JOIN [CentroPodologico].[RH].[empleados] emp ON emp.id_empleado = pe.id_empleado
         JOIN [CentroPodologico].[dbo].[sucursales] s ON s.id_sucursal = emp.id_sucursal
        WHERE pe.tipo_nomina = 'F'
          AND p.tipo_periodo = 'O'
          AND p.fecha_fin >= @year_start AND p.fecha_fin <= @year_end
          AND s.id_empresa = @id_empresa
     )
     SELECT f.id_empleado, emp.id_sucursal, emp.categoria_ptu, emp.tipo_contrato,
            CASE WHEN SUM(f.dias) > @max_days THEN @max_days ELSE SUM(f.dias) END AS dias,
            SUM(f.importe_salario) AS salario,
            MAX(CASE WHEN f.recency = 1 THEN f.salario_diario END) AS salario_diario_tope
       FROM fiscal_rows f
       JOIN [CentroPodologico].[RH].[empleados] emp ON emp.id_empleado = f.id_empleado
      GROUP BY f.id_empleado, emp.id_sucursal, emp.categoria_ptu, emp.tipo_contrato
      ORDER BY f.id_empleado`,
    {
      id_empresa,
      year_start: `${ejercicio}-01-01`,
      year_end: `${ejercicio}-12-31`,
      max_days: MAX_PRELOAD_DAYS,
    },
  )) as IPtuPreloadRow[];
  return rows.map((row) => ({
    ...row,
    dias: Number(row.dias),
    salario: Number(row.salario),
    salario_diario_tope: Number(row.salario_diario_tope),
  }));
}

/**
 * Empleados de la empresa que pudieron trabajar en el ejercicio y todavía no están en el reparto:
 * `fecha_ingreso` a más tardar el 31-dic y sin baja vigente anterior al 1-ene. Con `id_empleado`
 * devuelve a lo mucho ese empleado, para validar un alta en la acción.
 */
export async function loadPtuAddableEmployees(
  client: ITransactionClient,
  distribution: Pick<IPtuDistribution, "id_ptu_distribution" | "id_empresa" | "ejercicio">,
  id_empleado?: number,
): Promise<IPtuAddableEmployee[]> {
  const rows = (await client.queryParams(
    `SELECT e.id_empleado, e.id_sucursal, e.categoria_ptu, e.tipo_contrato, e.codigo_empleado,
            ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo, s.nombre AS nombre_sucursal,
            CONVERT(varchar(10), e.fecha_ingreso, 120) AS fecha_ingreso, e.salario_diario_fiscal
       FROM [CentroPodologico].[RH].[empleados] e
       JOIN [CentroPodologico].[dbo].[sucursales] s ON s.id_sucursal = e.id_sucursal
      WHERE s.id_empresa = @id_empresa
        AND e.status = 1
        AND e.fecha_ingreso <= @year_end
        AND NOT EXISTS (
              SELECT 1 FROM [CentroPodologico].[RH].[employee_terminations] t
               WHERE t.id_empleado = e.id_empleado AND t.anulado_at IS NULL AND t.fecha_baja < @year_start)
        AND NOT EXISTS (
              SELECT 1 FROM [CentroPodologico].[payroll].[ptu_distribution_employees] pe
               WHERE pe.id_ptu_distribution = @id_ptu_distribution AND pe.id_empleado = e.id_empleado)
        AND (@id_empleado IS NULL OR e.id_empleado = @id_empleado)
      ORDER BY nombre_completo`,
    {
      id_empresa: distribution.id_empresa,
      id_ptu_distribution: distribution.id_ptu_distribution,
      year_start: `${distribution.ejercicio}-01-01`,
      year_end: `${distribution.ejercicio}-12-31`,
      id_empleado: id_empleado ?? null,
    },
  )) as IPtuAddableEmployee[];
  return rows.map((row) => ({
    ...row,
    salario_diario_fiscal: row.salario_diario_fiscal === null ? null : Number(row.salario_diario_fiscal),
  }));
}
