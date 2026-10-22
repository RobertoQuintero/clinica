// Borrado de la Empresa Demo (spec 93, paso 2 del plan). Solo cubre lo que crea
// `seedOrganization.ts` (empresa, sucursal, usuarios, empleados, horarios y SBC); los pasos 3 y 4
// agregan aquí sus propias tablas, en orden de llaves foráneas, antes de llegar a este borrado.
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
 * Borra la Empresa Demo y todo lo que cuelga de ella (alcance del paso 2: empresa, sucursal,
 * usuarios, empleados, horarios y SBC). Si no existe ninguna empresa con `DEMO_COMPANY_NAME`, no
 * hace nada. Pensado para correr dentro de `db.transaction`, solo o antes de `seedOrganization`.
 */
export async function removeDemoOrganization(tx: ITransactionClient): Promise<void> {
  const id_empresa = await findDemoCompanyId(tx);
  if (id_empresa === null) return;

  await assertDemoOwnership(tx, id_empresa);

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
