import "server-only";

import db from "@/database/connection";
import { IPayrollMissingEmployee } from "@/interfaces/payroll_calculation";
import { EMPLOYEE_FULL_NAME_SQL } from "@/lib/payroll/employeeName";

/**
 * Aviso "capturas que no se pagarán" (spec 97): empleado con una captura de días pendientes de este periodo,
 * con tarifa > 0 en un tipo, sin fila en `period_employees` para ese tipo. No se paga ni se bloquea; se
 * corrige capturando el salario del tipo y recalculando, que es lo único que crea la fila. Mismo patrón que
 * `loadMissingEligibleEmployees` (spec 96), con el mismo tipo de salida para seguir la forma de
 * `MissingEmployeesNotice`.
 */
export async function loadPendingDaysNotCovered(idPeriod: number): Promise<IPayrollMissingEmployee[]> {
  const rows = await db.queryParams(
    `SELECT DISTINCT e.[id_empleado], e.[codigo_empleado], ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo,
            salary.[tipo_nomina]
       FROM [CentroPodologico].[payroll].[pending_day_payments] pdp
       JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = pdp.[id_empleado]
      CROSS APPLY (VALUES ('O', pdp.[tarifa_operativa]), ('F', pdp.[tarifa_fiscal]))
                  AS salary ([tipo_nomina], [tarifa_diaria])
      WHERE pdp.[id_period] = @id_period
        AND salary.[tarifa_diaria] > 0
        AND NOT EXISTS (
              SELECT 1 FROM [CentroPodologico].[payroll].[period_employees] pe
               WHERE pe.[id_period] = pdp.[id_period] AND pe.[id_empleado] = pdp.[id_empleado]
                 AND pe.[tipo_nomina] = salary.[tipo_nomina]
            )
      ORDER BY nombre_completo, e.[id_empleado], salary.[tipo_nomina]`,
    { id_period: idPeriod },
  );

  return rows as IPayrollMissingEmployee[];
}
