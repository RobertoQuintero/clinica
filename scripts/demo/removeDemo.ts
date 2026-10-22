// Borrado de la Empresa Demo (spec 93, pasos 2 a 4 del plan). Cubre lo que crea
// `seedOrganization.ts` (empresa, sucursal, usuarios, empleados, horarios y SBC), lo que crea
// `seedPayrollInputs.ts` (configuraciones de nómina, checadas, pacientes, consultas, tratamientos
// de onicomicosis, productos y ventas) y lo que crea `seedPeriods.ts` (periodos y reparto de PTU
// en borrador); el paso 6 agrega aquí los snapshots calculados, en orden de llaves foráneas, antes
// de llegar a este borrado.
// Se identifica por DEMO_COMPANY_NAME **y** DEMO_USER_EMAIL: si no coinciden los dos, no borra nada.
import type { ITransactionClient } from "@/database/connection";
import { DEMO_COMPANY_NAME, DEMO_USER_EMAIL } from "./constants";

export class DemoOwnershipMismatchError extends Error {
  constructor() {
    super(
      `Existe una empresa "${DEMO_COMPANY_NAME}" pero el usuario "${DEMO_USER_EMAIL}" no le pertenece. ` +
        "No se borró nada: revisa manualmente antes de volver a sembrar.",
    );
  }
}

async function findDemoCompanyId(tx: ITransactionClient): Promise<number | null> {
  const rows = (await tx.queryParams(
    `SELECT [id_empresa] FROM [CentroPodologico].[dbo].[empresas] WHERE [nombre] = @nombre`,
    { nombre: DEMO_COMPANY_NAME },
  )) as { id_empresa: number }[];
  return rows[0]?.id_empresa ?? null;
}

/** Lanza `DemoOwnershipMismatchError` si la empresa encontrada no es la Empresa Demo real. */
async function assertDemoOwnership(tx: ITransactionClient, id_empresa: number): Promise<void> {
  const rows = (await tx.queryParams(
    `SELECT TOP 1 1 AS found
       FROM [CentroPodologico].[dbo].[users]
      WHERE [id_empresa] = @id_empresa AND [email] = @email`,
    { id_empresa, email: DEMO_USER_EMAIL },
  )) as { found: number }[];

  if (rows.length === 0) throw new DemoOwnershipMismatchError();
}

/**
 * Borra la Empresa Demo y todo lo que cuelga de ella (alcance de los pasos 2 y 3: empresa,
 * sucursal, usuarios, empleados, horarios, SBC, configuraciones de nómina, checador y checadas,
 * pacientes, consultas, tratamientos de onicomicosis, productos y ventas). Si no existe ninguna
 * empresa con `DEMO_COMPANY_NAME`, no hace nada. Pensado para correr dentro de `db.transaction`,
 * solo o antes de `seedOrganization` + `seedPayrollInputs`.
 */
export async function removeDemoOrganization(tx: ITransactionClient): Promise<void> {
  const id_empresa = await findDemoCompanyId(tx);
  if (id_empresa === null) return;

  await assertDemoOwnership(tx, id_empresa);

  // -- Paso 3: inventario, consultas/tratamientos y ventas, antes de llegar a pacientes/productos --
  await tx.queryParams(
    `DELETE k
       FROM [CentroPodologico].[inventory].[kardex] k
       JOIN [CentroPodologico].[dbo].[sucursales] s ON s.[id_sucursal] = k.[id_sucursal]
      WHERE s.[id_empresa] = @id_empresa`,
    { id_empresa },
  );
  await tx.queryParams(
    `DELETE st
       FROM [CentroPodologico].[inventory].[stock] st
       JOIN [CentroPodologico].[dbo].[sucursales] s ON s.[id_sucursal] = st.[id_sucursal]
      WHERE s.[id_empresa] = @id_empresa`,
    { id_empresa },
  );
  await tx.queryParams(
    `DELETE cp
       FROM [CentroPodologico].[dbo].[consulta_productos] cp
       JOIN [CentroPodologico].[dbo].[consultas] c ON c.[id_consulta] = cp.[id_consulta]
      WHERE c.[id_empresa] = @id_empresa`,
    { id_empresa },
  );
  await tx.queryParams(
    `DELETE tp
       FROM [CentroPodologico].[dbo].[Tratamiento_onicomicosis_pagos] tp
       JOIN [CentroPodologico].[dbo].[Tratamiento_onicomicosis] t ON t.[id_tratamiento] = tp.[id_tratamiento]
       JOIN [CentroPodologico].[dbo].[consultas] c ON c.[id_consulta] = t.[id_consulta]
      WHERE c.[id_empresa] = @id_empresa`,
    { id_empresa },
  );
  await tx.queryParams(
    `DELETE t
       FROM [CentroPodologico].[dbo].[Tratamiento_onicomicosis] t
       JOIN [CentroPodologico].[dbo].[consultas] c ON c.[id_consulta] = t.[id_consulta]
      WHERE c.[id_empresa] = @id_empresa`,
    { id_empresa },
  );
  await tx.queryParams(
    `DELETE vd
       FROM [CentroPodologico].[dbo].[VentasDetalle] vd
       JOIN [CentroPodologico].[dbo].[Ventas] v ON v.[id_venta] = vd.[id_venta]
       JOIN [CentroPodologico].[dbo].[sucursales] s ON s.[id_sucursal] = v.[id_sucursal]
      WHERE s.[id_empresa] = @id_empresa`,
    { id_empresa },
  );
  await tx.queryParams(
    `DELETE v
       FROM [CentroPodologico].[dbo].[Ventas] v
       JOIN [CentroPodologico].[dbo].[sucursales] s ON s.[id_sucursal] = v.[id_sucursal]
      WHERE s.[id_empresa] = @id_empresa`,
    { id_empresa },
  );
  await tx.queryParams(`DELETE FROM [CentroPodologico].[dbo].[consultas] WHERE [id_empresa] = @id_empresa`, {
    id_empresa,
  });
  await tx.queryParams(`DELETE FROM [CentroPodologico].[dbo].[pacientes] WHERE [id_empresa] = @id_empresa`, {
    id_empresa,
  });
  await tx.queryParams(`DELETE FROM [CentroPodologico].[inventory].[Products] WHERE [id_empresa] = @id_empresa`, {
    id_empresa,
  });

  // -- Paso 3: checadas y checador, antes de llegar a empleados/sucursal --
  await tx.queryParams(
    `DELETE a
       FROM [CentroPodologico].[RH].[asistencias] a
       JOIN [CentroPodologico].[RH].[checadores] c ON c.[id_checador] = a.[id_checador]
       JOIN [CentroPodologico].[dbo].[sucursales] s ON s.[id_sucursal] = c.[id_sucursal]
      WHERE s.[id_empresa] = @id_empresa`,
    { id_empresa },
  );
  await tx.queryParams(
    `DELETE c
       FROM [CentroPodologico].[RH].[checadores] c
       JOIN [CentroPodologico].[dbo].[sucursales] s ON s.[id_sucursal] = c.[id_sucursal]
      WHERE s.[id_empresa] = @id_empresa`,
    { id_empresa },
  );

  // -- Paso 3: configuraciones de nómina por empresa, antes de llegar a empleados --
  await tx.queryParams(
    `DELETE sea
       FROM [CentroPodologico].[payroll].[shift_extension_assignments] sea
       JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = sea.[id_empleado]
      WHERE e.[id_empresa] = @id_empresa`,
    { id_empresa },
  );
  await tx.queryParams(`DELETE FROM [CentroPodologico].[payroll].[lateness_tiers] WHERE [id_empresa] = @id_empresa`, {
    id_empresa,
  });
  await tx.queryParams(`DELETE FROM [CentroPodologico].[payroll].[lateness_settings] WHERE [id_empresa] = @id_empresa`, {
    id_empresa,
  });
  await tx.queryParams(
    `DELETE FROM [CentroPodologico].[payroll].[punctuality_bonus_settings] WHERE [id_empresa] = @id_empresa`,
    { id_empresa },
  );
  await tx.queryParams(
    `DELETE FROM [CentroPodologico].[payroll].[attendance_bonus_settings] WHERE [id_empresa] = @id_empresa`,
    { id_empresa },
  );
  await tx.queryParams(`DELETE FROM [CentroPodologico].[payroll].[overtime_settings] WHERE [id_empresa] = @id_empresa`, {
    id_empresa,
  });
  await tx.queryParams(
    `DELETE FROM [CentroPodologico].[payroll].[treatment_commission_settings] WHERE [id_empresa] = @id_empresa`,
    { id_empresa },
  );
  await tx.queryParams(`DELETE FROM [CentroPodologico].[payroll].[commission_tiers] WHERE [id_empresa] = @id_empresa`, {
    id_empresa,
  });

  // -- Paso 4: periodos y reparto de PTU en borrador, antes de llegar a la sucursal --
  await tx.queryParams(
    `DELETE l
       FROM [CentroPodologico].[payroll].[ptu_distribution_log] l
       JOIN [CentroPodologico].[payroll].[ptu_distributions] d ON d.[id_ptu_distribution] = l.[id_ptu_distribution]
      WHERE d.[id_empresa] = @id_empresa`,
    { id_empresa },
  );
  await tx.queryParams(
    `DELETE pde
       FROM [CentroPodologico].[payroll].[ptu_distribution_employees] pde
       JOIN [CentroPodologico].[payroll].[ptu_distributions] d ON d.[id_ptu_distribution] = pde.[id_ptu_distribution]
      WHERE d.[id_empresa] = @id_empresa`,
    { id_empresa },
  );
  await tx.queryParams(
    `DELETE FROM [CentroPodologico].[payroll].[ptu_distributions] WHERE [id_empresa] = @id_empresa`,
    { id_empresa },
  );
  await tx.queryParams(
    `DELETE p
       FROM [CentroPodologico].[payroll].[periods] p
       JOIN [CentroPodologico].[dbo].[sucursales] s ON s.[id_sucursal] = p.[id_sucursal]
      WHERE s.[id_empresa] = @id_empresa`,
    { id_empresa },
  );

  // -- Paso 2: empresa, sucursal, usuarios, empleados, horarios y SBC --
  await tx.queryParams(
    `DELETE eh
       FROM [CentroPodologico].[RH].[empleado_horarios] eh
       JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = eh.[id_empleado]
      WHERE e.[id_empresa] = @id_empresa`,
    { id_empresa },
  );
  await tx.queryParams(
    `DELETE sl
       FROM [CentroPodologico].[RH].[employee_sbc_log] sl
       JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = sl.[id_empleado]
      WHERE e.[id_empresa] = @id_empresa`,
    { id_empresa },
  );
  await tx.queryParams(
    `DELETE s
       FROM [CentroPodologico].[RH].[employee_sbc] s
       JOIN [CentroPodologico].[RH].[empleados] e ON e.[id_empleado] = s.[id_empleado]
      WHERE e.[id_empresa] = @id_empresa`,
    { id_empresa },
  );
  // Los usuarios se borran antes que los empleados: FK_users_empleado apunta de users a empleados.
  await tx.queryParams(`DELETE FROM [CentroPodologico].[dbo].[users] WHERE [id_empresa] = @id_empresa`, {
    id_empresa,
  });
  await tx.queryParams(`DELETE FROM [CentroPodologico].[RH].[empleados] WHERE [id_empresa] = @id_empresa`, {
    id_empresa,
  });
  await tx.queryParams(`DELETE FROM [CentroPodologico].[dbo].[sucursales] WHERE [id_empresa] = @id_empresa`, {
    id_empresa,
  });
  await tx.queryParams(`DELETE FROM [CentroPodologico].[dbo].[empresas] WHERE [id_empresa] = @id_empresa`, {
    id_empresa,
  });
}
