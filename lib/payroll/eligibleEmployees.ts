import "server-only";

import { ABSENCE_CONTROL_ROLE_IDS } from "@/lib/payroll/constants";

/**
 * Condiciones (spec 53) comunes a las dos nóminas: quién puede entrar a un periodo, sin mirar el salario.
 * `calculatePayrollPeriod` les suma la condición de salario de cada tipo ('O' y 'F' se evalúan por separado).
 * Se pegan en un WHERE sobre `[RH].[empleados] e` y esperan los parámetros
 * @id_sucursal, @id_payment_period y @fecha_fin (los del periodo).
 */
export const ELIGIBLE_EMPLOYEE_BASE_CONDITIONS = `
  e.status = 1 AND e.activo = 1
  AND e.id_sucursal = @id_sucursal
  AND e.id_periodo_pago = @id_payment_period
  AND e.fecha_ingreso <= @fecha_fin`;

/** Condiciones de los empleados que entran a la nómina operativa de un periodo: la base más salario operativo > 0. */
export const ELIGIBLE_OPERATIVE_EMPLOYEE_CONDITIONS = `${ELIGIBLE_EMPLOYEE_BASE_CONDITIONS}
  AND e.salario_diario > 0`;

/**
 * Empleados que entran a **alguna** de las dos nóminas del periodo (spec 62): la base más salario operativo
 * o fiscal > 0. Es el universo del que se toman los empleados con control de faltas.
 */
export const ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS = `${ELIGIBLE_EMPLOYEE_BASE_CONDITIONS}
  AND (e.salario_diario > 0 OR e.salario_diario_fiscal > 0)`;

/**
 * Empleado con control de faltas (spec 62): tiene al menos un usuario vinculado activo con un rol de
 * `ABSENCE_CONTROL_ROLE_IDS`. Se pega en un WHERE sobre `[RH].[empleados] e`; el rol se evalúa en el momento.
 * La lista de roles sale de la constante, nunca de la entrada del cliente.
 */
export const ABSENCE_CONTROLLED_EMPLOYEE_CONDITION = `EXISTS (
    SELECT 1 FROM [CentroPodologico].[dbo].[users] u
     WHERE u.[id_empleado] = e.[id_empleado]
       AND u.[id_role] IN (${ABSENCE_CONTROL_ROLE_IDS.join(", ")})
       AND u.[status] = 1)`;
