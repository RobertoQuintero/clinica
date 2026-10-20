import "server-only";

import db from "@/database/connection";
import type { PtuTaxpayerType } from "@/interfaces/payroll_ptu";
import { EMPLOYEE_FULL_NAME_SQL } from "@/lib/payroll/employeeName";

export const PTU_DISTRIBUTION_NOT_CLOSED_MARKER = "PTU_DISTRIBUTION_NOT_CLOSED";
export const PTU_NO_PAYABLE_ROWS_MARKER = "PTU_NO_PAYABLE_ROWS";

/**
 * Precondición del alta de un periodo PTU, para correr dentro de la transacción del alta (espera `@id_sucursal` y
 * `@ejercicio`, el año de pago). Bloquea el reparto del año − 1 con UPDLOCK/HOLDLOCK para que no se reabra entre la
 * revisión y el INSERT. Deja `@id_ptu_distribution` declarada para quien la necesite después.
 */
export const PTU_PAYMENT_PRECONDITION_SQL = `
       DECLARE @id_ptu_distribution int, @ptu_estado char(1);
       SELECT @id_ptu_distribution = d.id_ptu_distribution, @ptu_estado = d.estado
         FROM [CentroPodologico].[payroll].[ptu_distributions] d WITH (UPDLOCK, HOLDLOCK)
         JOIN [CentroPodologico].[dbo].[sucursales] s ON s.id_empresa = d.id_empresa
        WHERE s.id_sucursal = @id_sucursal AND d.ejercicio = @ejercicio - 1;
       IF @id_ptu_distribution IS NULL OR @ptu_estado <> 'C'
         THROW 50006, '${PTU_DISTRIBUTION_NOT_CLOSED_MARKER}', 1;
       IF NOT EXISTS (
         SELECT 1 FROM [CentroPodologico].[payroll].[ptu_distribution_employees]
          WHERE id_ptu_distribution = @id_ptu_distribution AND id_sucursal = @id_sucursal AND ptu_final > 0
       )
         THROW 50007, '${PTU_NO_PAYABLE_ROWS_MARKER}', 1;`;

export interface IPtuPaymentSource {
  /** Reparto **cerrado** de la empresa para el año − 1; null si no existe o sigue en borrador. */
  distribution: { id_ptu_distribution: number; tipo_persona: PtuTaxpayerType } | null;
  /** Filas del reparto cuyo `id_sucursal` congelado es la sucursal y que tienen `ptu_final > 0`. */
  payableRowCount: number;
  /** Trabajadores pagables con `salario_diario_tope = 0`: bloquean el cálculo. */
  zeroCapEmployeeNames: string[];
}

/** Empresa de la sucursal (nunca la del cliente ni la de la sesión). null si la sucursal no existe. */
export async function loadBranchCompanyId(idSucursal: number): Promise<number | null> {
  const rows = (await db.queryParams(
    `SELECT id_empresa FROM [CentroPodologico].[dbo].[sucursales] WHERE id_sucursal = @id_sucursal`,
    { id_sucursal: idSucursal },
  )) as { id_empresa: number | null }[];
  return rows[0]?.id_empresa ?? null;
}

/** Lo que se va a pagar de PTU en un año de pago: el reparto cerrado del año anterior y sus filas de la sucursal. */
export async function loadPtuPaymentSource(
  idEmpresa: number,
  idSucursal: number,
  paymentYear: number,
): Promise<IPtuPaymentSource> {
  const distributionRows = (await db.queryParams(
    `SELECT id_ptu_distribution, tipo_persona
       FROM [CentroPodologico].[payroll].[ptu_distributions]
      WHERE id_empresa = @id_empresa AND ejercicio = @distribution_year AND estado = 'C'`,
    { id_empresa: idEmpresa, distribution_year: paymentYear - 1 },
  )) as { id_ptu_distribution: number; tipo_persona: PtuTaxpayerType }[];
  const distribution = distributionRows[0] ?? null;
  if (!distribution) return { distribution: null, payableRowCount: 0, zeroCapEmployeeNames: [] };

  const payableRows = (await db.queryParams(
    `SELECT r.salario_diario_tope, ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo
       FROM [CentroPodologico].[payroll].[ptu_distribution_employees] r
       JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = r.id_empleado
      WHERE r.id_ptu_distribution = @id_ptu_distribution
        AND r.id_sucursal = @id_sucursal
        AND r.ptu_final > 0
      ORDER BY e.apellido_paterno, e.apellido_materno, e.nombre, e.id_empleado`,
    { id_ptu_distribution: distribution.id_ptu_distribution, id_sucursal: idSucursal },
  )) as { salario_diario_tope: number; nombre_completo: string }[];

  return {
    distribution,
    payableRowCount: payableRows.length,
    zeroCapEmployeeNames: payableRows
      .filter((row) => Number(row.salario_diario_tope) <= 0)
      .map((row) => row.nombre_completo),
  };
}
