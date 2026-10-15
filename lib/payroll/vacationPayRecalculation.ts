import "server-only";

import db from "@/database/connection";
import { VACATION_PAY_EVENTS_SQL } from "@/lib/payroll/vacationPaySql";

/**
 * Aviso "Recalcula" de la prima vacacional y los días no disfrutados pagados (spec 78): ¿los eventos de vacaciones de
 * hoy ya no coinciden con lo que congeló el último cálculo? Solo aplica a periodos en estatus 2 (En cálculo); en
 * cualquier otro estatus responde false. Responde true cuando:
 *   1. hay un evento con fecha dentro del periodo que ningún periodo ha pagado en el tipo de un renglón del snapshot
 *      (bloque nuevo, pago marcado o movido al rango, o liberado por otro recálculo);
 *   2. una fila guardada del desglose ya no corresponde a un evento actual: el bloque se canceló o salió del rango, el
 *      pago se revirtió o cambió de fecha, o cambiaron los días.
 * Los eventos salen de `VACATION_PAY_EVENTS_SQL`, el mismo fragmento del cálculo, y el candado se lee igual que ahí.
 * Un concepto ya pagado por otro periodo en ese tipo no activa el aviso: el cálculo tampoco lo pagaría.
 */
export async function isVacationPayRecalculationNeeded(idPeriod: number): Promise<boolean> {
  const rows = await db.queryParams(
    `SET NOCOUNT ON;
     DECLARE @fecha_inicio date, @fecha_fin date;
     SELECT @fecha_inicio = fecha_inicio, @fecha_fin = fecha_fin
       FROM [CentroPodologico].[payroll].[periods]
      WHERE id_period = @id_period AND status = 2;
     IF @fecha_inicio IS NULL
     BEGIN
       SELECT 0 AS recalculation_needed;
       RETURN;
     END

     SELECT CASE WHEN EXISTS (
              -- 1. Evento del rango sin pagar en el tipo de un renglón del snapshot.
              SELECT 1
                FROM [CentroPodologico].[payroll].[period_employees] pe
                JOIN (${VACATION_PAY_EVENTS_SQL}
                     ) ev ON ev.[id_empleado] = pe.[id_empleado]
               WHERE pe.[id_period] = @id_period
                 AND NOT EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_vacations] pev
                                  WHERE pev.[id_vacation_entitlement] = ev.[id_vacation_entitlement]
                                    AND pev.[concepto] = ev.[concepto]
                                    AND pev.[tipo_nomina] = pe.[tipo_nomina])
            ) OR EXISTS (
              -- 2. Fila del desglose de este periodo cuyo evento ya no existe, o cambió de fecha o de días.
              SELECT 1
                FROM [CentroPodologico].[payroll].[period_employees] pe
                JOIN [CentroPodologico].[payroll].[period_employee_vacations] pev
                  ON pev.[id_period_employee] = pe.[id_period_employee]
               WHERE pe.[id_period] = @id_period
                 AND NOT EXISTS (SELECT 1
                                   FROM (${VACATION_PAY_EVENTS_SQL}
                                        ) ev
                                  WHERE ev.[id_vacation_entitlement] = pev.[id_vacation_entitlement]
                                    AND ev.[concepto] = pev.[concepto]
                                    AND ev.[fecha_evento] = pev.[fecha_evento]
                                    AND ev.[dias] = pev.[dias])
            ) THEN 1 ELSE 0 END AS recalculation_needed;`,
    { id_period: idPeriod },
  );
  return Number(rows[0]?.recalculation_needed ?? 0) === 1;
}
