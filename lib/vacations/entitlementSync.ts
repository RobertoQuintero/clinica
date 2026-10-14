import "server-only";
import db from "@/database/connection";
import { addZeroToday, buildDate } from "@/utils/date_helpper";

/**
 * Genera los años de derecho a vacaciones que falten (spec 76). Un solo
 * `INSERT … SELECT … WHERE NOT EXISTS` por conjunto, idempotente:
 *   - empleado activo sin filas: solo el año vigente (último aniversario cumplido);
 *   - empleado con filas: todos los aniversarios posteriores a su último año registrado.
 * Los años sin rango en el catálogo (> 50 años de servicio) no se generan.
 *
 * Nunca lanza: si falla (BD caída, permisos, carrera con otra sincronización) se registra
 * y la página sigue mostrando lo que ya existe.
 */
export async function syncVacationEntitlements(
  id_empresa: number,
  id_empleado?: number
): Promise<void> {
  try {
    const now = new Date();
    await db.queryParams(
      `;WITH service_years AS (
           SELECT n FROM (VALUES
               (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12),(13),(14),(15),(16),(17),(18),(19),(20),
               (21),(22),(23),(24),(25),(26),(27),(28),(29),(30),(31),(32),(33),(34),(35),(36),(37),(38),(39),(40),
               (41),(42),(43),(44),(45),(46),(47),(48),(49),(50)
           ) AS v(n)
       ),
       employee_progress AS (
           SELECT e.[id_empleado],
                  e.[fecha_ingreso],
                  DATEDIFF(YEAR, e.[fecha_ingreso], CONVERT(date, @today, 23))
                    - CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, e.[fecha_ingreso], CONVERT(date, @today, 23)), e.[fecha_ingreso])
                                > CONVERT(date, @today, 23) THEN 1 ELSE 0 END AS completed_years,
                  (SELECT MAX(x.[anio_servicio])
                     FROM [CentroPodologico].[RH].[vacation_entitlements] x
                    WHERE x.[id_empleado] = e.[id_empleado]) AS last_recorded_year
             FROM [CentroPodologico].[RH].[empleados] e
            WHERE e.[id_empresa] = @id_empresa
              AND e.[activo] = 1
              AND e.[fecha_ingreso] IS NOT NULL
              AND (@id_empleado IS NULL OR e.[id_empleado] = @id_empleado)
       )
       INSERT INTO [CentroPodologico].[RH].[vacation_entitlements]
              ([id_empleado], [anio_servicio], [fecha_aniversario], [fecha_limite_solicitud],
               [fecha_siguiente_aniversario], [dias_derecho], [created_at])
       SELECT p.[id_empleado],
              y.n,
              DATEADD(YEAR, y.n, p.[fecha_ingreso]),
              DATEADD(MONTH, 6, DATEADD(YEAR, y.n, p.[fecha_ingreso])),
              DATEADD(YEAR, y.n + 1, p.[fecha_ingreso]),
              c.[dias],
              @created_at
         FROM employee_progress p
         JOIN service_years y
           ON y.n >= CASE WHEN p.last_recorded_year IS NULL THEN p.completed_years ELSE p.last_recorded_year + 1 END
          AND y.n <= p.completed_years
          AND y.n >= 1
         JOIN [CentroPodologico].[RH].[vacation_days_by_seniority] c
           ON y.n BETWEEN c.[anio_desde] AND c.[anio_hasta]
        WHERE NOT EXISTS (
              SELECT 1 FROM [CentroPodologico].[RH].[vacation_entitlements] x
               WHERE x.[id_empleado] = p.[id_empleado] AND x.[anio_servicio] = y.n)`,
      {
        id_empresa,
        id_empleado: id_empleado ?? null,
        today: addZeroToday(now),
        created_at: buildDate(now),
      }
    );
  } catch (error) {
    console.error("[vacations] syncVacationEntitlements falló", error);
  }
}
