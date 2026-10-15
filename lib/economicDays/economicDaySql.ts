import "server-only";
import db from "@/database/connection";

/**
 * Spec 79: primer día económico activo (no cancelado) de un empleado dentro de un rango de fechas
 * cerrado. Parámetros: `@id_empleado`, `@range_start`, `@range_end`. Es la única definición SQL de
 * la regla: la validación de vacaciones la usa hoy y la exclusión en nómina la importará después.
 */
export const ACTIVE_ECONOMIC_DAY_IN_RANGE_SQL = `
  SELECT TOP 1 CONVERT(varchar(10), [fecha], 120) AS fecha
    FROM [CentroPodologico].[RH].[economic_days]
   WHERE [id_empleado] = @id_empleado
     AND [cancelado_at] IS NULL
     AND [fecha] BETWEEN @range_start AND @range_end
   ORDER BY [fecha]`;

/** "YYYY-MM-DD" del primer día económico activo en `range_start..range_end`, o `null` si no hay. */
export async function findActiveEconomicDayInRange(
  id_empleado: number,
  range_start: string,
  range_end: string
): Promise<string | null> {
  const [economicDay] = (await db.queryParams(ACTIVE_ECONOMIC_DAY_IN_RANGE_SQL, {
    id_empleado,
    range_start,
    range_end,
  })) as { fecha: string }[];
  return economicDay?.fecha ?? null;
}
