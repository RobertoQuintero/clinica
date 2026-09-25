import "server-only";

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
