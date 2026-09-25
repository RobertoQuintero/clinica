import "server-only";

/**
 * Condiciones (spec 53) de los empleados que entran a la nómina operativa de un periodo.
 * Se pegan en un WHERE sobre `[RH].[empleados] e` y esperan los parámetros
 * @id_sucursal, @id_payment_period y @fecha_fin (los del periodo).
 */
export const ELIGIBLE_OPERATIVE_EMPLOYEE_CONDITIONS = `
  e.status = 1 AND e.activo = 1
  AND e.id_sucursal = @id_sucursal
  AND e.id_periodo_pago = @id_payment_period
  AND e.fecha_ingreso <= @fecha_fin
  AND e.salario_diario > 0`;
