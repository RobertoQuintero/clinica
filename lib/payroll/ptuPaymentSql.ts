import "server-only";

import { EMPLOYEE_FULL_NAME_SQL } from "@/lib/payroll/employeeName";
import { PTU_PERCEPTION_ID } from "@/lib/payroll/constants";
import {
  EXEMPTION_APPLY_SQL,
  EXEMPTION_INSERT_COLUMNS_SQL,
  EXEMPTION_PARAMETERS_SQL,
  EXEMPTION_SELECT_SQL,
} from "@/lib/payroll/exemptionSql";
import { PTU_PAYMENT_PRECONDITION_SQL } from "@/lib/payroll/ptuPaymentSource";

export const PTU_ZERO_DAILY_CAP_MARKER = "PTU_ZERO_DAILY_CAP";
export const PTU_ALREADY_PAID_CONSTRAINT = "UQ_period_employee_ptu_distribution_employee";

/**
 * Snapshot de la PTU de un periodo extraordinario de concepto 'P' (spec 90), para pegar en el batch de
 * `calculatePayrollPeriod` después de leer el periodo (@id_period, @id_sucursal, @id_payment_period, @ejercicio,
 * @fecha_inicio, @fecha_fin) y de borrar el snapshot anterior. El reparto de PTU manda: el periodo solo lo paga.
 *
 * - Exige el reparto **cerrado** de la empresa de la sucursal para @ejercicio − 1 (bloqueado con UPDLOCK/HOLDLOCK, así
 *   que "Reabrir" no puede correr en paralelo) y que la sucursal tenga filas con `ptu_final > 0`.
 * - Si alguna fila pagable tiene `salario_diario_tope = 0` aborta con `PTU_ZERO_DAILY_CAP:{nombres}` sin escribir nada.
 * - Una fila fiscal ('F') por fila pagable del reparto, incluidos los dados de baja: `salario_diario` = tope congelado
 *   del reparto, `importe_ptu` = `ptu_final`, y todo lo demás en 0 (el periodo no paga sueldo ni ningún otro concepto).
 *   Las columnas isr_* de la spec 70 se quedan en 'X'.
 * - `period_employee_ptu` liga la fila con su fila del reparto, congela el desglose y, con su UNIQUE, impide pagar una
 *   fila del reparto dos veces en toda la historia.
 * - La línea de percepción PTU (clave 003) pasa por el motor de gravado/exento de la spec 73: exento hasta 15 UMA por
 *   año de `fecha_fin`, acumulado entre periodos.
 */
export const PTU_PAYMENT_SNAPSHOT_SQL = `
       ${PTU_PAYMENT_PRECONDITION_SQL}

       DECLARE @zero_cap_names nvarchar(max) = (
         SELECT STRING_AGG(${EMPLOYEE_FULL_NAME_SQL}, ', ')
           FROM [CentroPodologico].[payroll].[ptu_distribution_employees] r
           JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = r.[id_empleado]
          WHERE r.[id_ptu_distribution] = @id_ptu_distribution
            AND r.[id_sucursal] = @id_sucursal
            AND r.[ptu_final] > 0
            AND r.[salario_diario_tope] <= 0
       );
       IF @zero_cap_names IS NOT NULL
       BEGIN
         DECLARE @zero_cap_message nvarchar(max) = '${PTU_ZERO_DAILY_CAP_MARKER}:' + @zero_cap_names;
         THROW 50008, @zero_cap_message, 1;
       END;

       INSERT INTO [CentroPodologico].[payroll].[period_employees]
         (id_period, id_empleado, tipo_nomina, salario_diario, dias, importe_salario, importe_ptu,
          calculated_by, calculated_at)
       SELECT @id_period, r.[id_empleado], 'F', r.[salario_diario_tope], 0, 0, r.[ptu_final],
              @calculated_by, CAST(@calculated_at AS datetime2(0))
         FROM [CentroPodologico].[payroll].[ptu_distribution_employees] r
        WHERE r.[id_ptu_distribution] = @id_ptu_distribution
          AND r.[id_sucursal] = @id_sucursal
          AND r.[ptu_final] > 0;

       INSERT INTO [CentroPodologico].[payroll].[period_employee_ptu]
         (id_period_employee, id_ptu_distribution_employee, id_ptu_distribution, ejercicio_reparto, dias,
          ptu_dias, ptu_salario, ptu_bruto, tope_tres_meses, promedio_tres_anios, anios_promedio, ptu_final)
       SELECT pe.[id_period_employee], r.[id_ptu_distribution_employee], r.[id_ptu_distribution], @ejercicio - 1, r.[dias],
              r.[ptu_dias], r.[ptu_salario], r.[ptu_bruto], r.[tope_tres_meses], r.[promedio_tres_anios],
              r.[anios_promedio], r.[ptu_final]
         FROM [CentroPodologico].[payroll].[period_employees] pe
         JOIN [CentroPodologico].[payroll].[ptu_distribution_employees] r
           ON r.[id_empleado] = pe.[id_empleado] AND r.[id_ptu_distribution] = @id_ptu_distribution
        WHERE pe.[id_period] = @id_period
          AND r.[id_sucursal] = @id_sucursal
          AND r.[ptu_final] > 0;

       -- Spec 73: la PTU de los renglones 'F' es la única línea de percepción del periodo.
       CREATE TABLE #fiscal_perception_lines (
         id_period_employee int NOT NULL,
         id_perception      smallint NOT NULL,
         importe            decimal(12,2) NOT NULL,
         eventos            smallint NULL
       );
       INSERT INTO #fiscal_perception_lines (id_period_employee, id_perception, importe, eventos)
       SELECT pe.[id_period_employee], ${PTU_PERCEPTION_ID}, pe.[importe_ptu], NULL
         FROM [CentroPodologico].[payroll].[period_employees] pe
        WHERE pe.[id_period] = @id_period AND pe.[tipo_nomina] = 'F' AND pe.[importe_ptu] > 0;

       ${EXEMPTION_PARAMETERS_SQL}

       -- La regla se lee del catálogo en este momento y queda congelada en el renglón.
       INSERT INTO [CentroPodologico].[payroll].[period_employee_perceptions] (${EXEMPTION_INSERT_COLUMNS_SQL})
       SELECT ${EXEMPTION_SELECT_SQL}
         FROM #fiscal_perception_lines fl
         JOIN [CentroPodologico].[payroll].[period_employees] pe
           ON pe.[id_period_employee] = fl.[id_period_employee]
         JOIN [CentroPodologico].[payroll].[perceptions] exemption_rule
           ON exemption_rule.[id_perception] = fl.[id_perception]${EXEMPTION_APPLY_SQL};`;
