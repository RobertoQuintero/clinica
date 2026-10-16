import "server-only";

import { ELIGIBLE_CHRISTMAS_BONUS_EMPLOYEE_CONDITIONS } from "@/lib/payroll/eligibleEmployees";
import {
  CHRISTMAS_BONUS_DAYS,
  CHRISTMAS_BONUS_PERCEPTION_ID,
  CHRISTMAS_BONUS_YEAR_DAYS,
} from "@/lib/payroll/constants";
import {
  EXEMPTION_APPLY_SQL,
  EXEMPTION_INSERT_COLUMNS_SQL,
  EXEMPTION_PARAMETERS_SQL,
  EXEMPTION_SELECT_SQL,
} from "@/lib/payroll/exemptionSql";

/**
 * Snapshot del aguinaldo de un periodo extraordinario (spec 87), para pegar en el batch de `calculatePayrollPeriod`
 * después de leer el periodo (@id_period, @id_sucursal, @id_payment_period, @fecha_inicio, @fecha_fin) y de borrar el
 * snapshot anterior. `lib/payroll/christmasBonus.ts` lo espeja y, si divergen, manda este SQL.
 *
 * - Una fila por empleado elegible y tipo de nómina ('O' con salario_diario, 'F' con salario_diario_fiscal; un tipo con
 *   salario 0 no genera fila). `dias` y `importe_salario` quedan en 0: el periodo extraordinario no paga sueldo ni
 *   ningún otro concepto, y las demás columnas toman su default.
 * - Días = fecha_fin − max(fecha_inicio, fecha_ingreso) + 1, sin descontar faltas.
 * - Importe = ROUND(salario × 15 × días / 365, 2); 365 fijo, también en año bisiesto.
 * - Las filas 'F' pasan su aguinaldo por el motor de gravado/exento de la spec 73 (exento hasta 30 UMA por año).
 */
export const CHRISTMAS_BONUS_SNAPSHOT_SQL = `
       INSERT INTO [CentroPodologico].[payroll].[period_employees]
         (id_period, id_empleado, tipo_nomina, salario_diario, dias, importe_salario,
          dias_aguinaldo, importe_aguinaldo, calculated_by, calculated_at)
       SELECT @id_period, e.[id_empleado], salary.[tipo_nomina], salary.[salario_diario], 0, 0,
              bonus_days.[dias],
              ROUND(salary.[salario_diario] * ${CHRISTMAS_BONUS_DAYS} * bonus_days.[dias] / ${CHRISTMAS_BONUS_YEAR_DAYS}, 2),
              @calculated_by, CAST(@calculated_at AS datetime2(0))
         FROM [CentroPodologico].[RH].[empleados] e
        CROSS APPLY (VALUES ('O', e.[salario_diario]), ('F', e.[salario_diario_fiscal]))
                    AS salary ([tipo_nomina], [salario_diario])
        CROSS APPLY (SELECT DATEDIFF(day,
                              CASE WHEN e.[fecha_ingreso] > @fecha_inicio THEN e.[fecha_ingreso] ELSE @fecha_inicio END,
                              @fecha_fin) + 1 AS dias) AS bonus_days
        WHERE ${ELIGIBLE_CHRISTMAS_BONUS_EMPLOYEE_CONDITIONS}
          AND salary.[salario_diario] > 0;

       -- Spec 73: el aguinaldo de los renglones 'F' es la única línea de percepción del periodo extraordinario.
       CREATE TABLE #fiscal_perception_lines (
         id_period_employee int NOT NULL,
         id_perception      smallint NOT NULL,
         importe            decimal(12,2) NOT NULL,
         eventos            smallint NULL
       );
       INSERT INTO #fiscal_perception_lines (id_period_employee, id_perception, importe, eventos)
       SELECT pe.[id_period_employee], ${CHRISTMAS_BONUS_PERCEPTION_ID}, pe.[importe_aguinaldo], NULL
         FROM [CentroPodologico].[payroll].[period_employees] pe
        WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F' AND pe.[importe_aguinaldo] > 0;

       ${EXEMPTION_PARAMETERS_SQL}

       -- La regla se lee del catálogo en este momento y queda congelada en el renglón.
       INSERT INTO [CentroPodologico].[payroll].[period_employee_perceptions] (${EXEMPTION_INSERT_COLUMNS_SQL})
       SELECT ${EXEMPTION_SELECT_SQL}
         FROM #fiscal_perception_lines fl
         JOIN [CentroPodologico].[payroll].[period_employees] pe
           ON pe.[id_period_employee] = fl.[id_period_employee]
         JOIN [CentroPodologico].[payroll].[perceptions] exemption_rule
           ON exemption_rule.[id_perception] = fl.[id_perception]${EXEMPTION_APPLY_SQL};`;
