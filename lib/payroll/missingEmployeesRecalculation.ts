import "server-only";

import db from "@/database/connection";
import { IPayrollMissingEmployee } from "@/interfaces/payroll_calculation";
import { IPayrollPeriodRow } from "@/interfaces/payroll_period";
import { ELIGIBLE_CHRISTMAS_BONUS_EMPLOYEE_CONDITIONS, ELIGIBLE_EMPLOYEE_BASE_CONDITIONS } from "@/lib/payroll/eligibleEmployees";
import { EMPLOYEE_FULL_NAME_SQL } from "@/lib/payroll/employeeName";

type PeriodForMissingEmployees = Pick<
  IPayrollPeriodRow,
  "id_period" | "id_sucursal" | "id_payment_period" | "fecha_fin" | "tipo_periodo" | "concepto_extraordinario"
>;

/**
 * Aviso doce (spec 96): empleado elegible **hoy**, con salario del tipo > 0, sin fila en `period_employees`
 * para ese tipo. Es el contratado, reactivado, transferido o con frecuencia capturada después del cálculo.
 * Solo se evalúa en estatus 2 y 3 (el `EXISTS` sobre `payroll.periods` corre dentro del SQL, nunca confía en
 * lo que mande el cliente); en cualquier otro estatus, o en un periodo de PTU, devuelve `[]` sin consultar nada.
 * Las condiciones de elegibilidad son las mismas constantes que usa el `INSERT` del cálculo, no una copia.
 */
export async function loadMissingEligibleEmployees(
  period: PeriodForMissingEmployees,
): Promise<IPayrollMissingEmployee[]> {
  const isPtuPeriod = period.tipo_periodo === "E" && period.concepto_extraordinario === "P";
  if (isPtuPeriod) return [];

  const isChristmasBonusPeriod = period.tipo_periodo === "E" && period.concepto_extraordinario === "A";

  const eligibleConditions = isChristmasBonusPeriod
    ? ELIGIBLE_CHRISTMAS_BONUS_EMPLOYEE_CONDITIONS
    : ELIGIBLE_EMPLOYEE_BASE_CONDITIONS;

  const rows = await db.queryParams(
    `SELECT e.[id_empleado], e.[codigo_empleado], ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo,
            salary.[tipo_nomina]
       FROM [CentroPodologico].[RH].[empleados] e
      CROSS APPLY (VALUES ('O', e.[salario_diario]), ('F', e.[salario_diario_fiscal]))
                  AS salary ([tipo_nomina], [salario_diario])
      WHERE ${eligibleConditions}
        AND salary.[salario_diario] > 0
        AND EXISTS (
              SELECT 1 FROM [CentroPodologico].[payroll].[periods] p
               WHERE p.[id_period] = @id_period AND p.[status] IN (2, 3)
            )
        AND NOT EXISTS (
              SELECT 1 FROM [CentroPodologico].[payroll].[period_employees] pe
               WHERE pe.[id_period] = @id_period AND pe.[id_empleado] = e.[id_empleado]
                 AND pe.[tipo_nomina] = salary.[tipo_nomina]
            )
      ORDER BY e.[apellido_paterno], e.[apellido_materno], e.[nombre], e.[id_empleado], salary.[tipo_nomina]`,
    {
      id_period:         period.id_period,
      id_sucursal:       period.id_sucursal,
      id_payment_period: period.id_payment_period,
      fecha_fin:         period.fecha_fin,
    },
  );

  return rows as IPayrollMissingEmployee[];
}
