// Siembra de la Empresa Demo (spec 93, paso 2 del plan): empresa, sucursal, usuario demo, los 7
// empleados de DEMO_EMPLOYEES, su horario semanal, su SBC y los usuarios rol 2 vinculados a los
// podólogos. Corre dentro del `db.transaction` que orquesta `seed-demo-nomina.ts`, junto con el
// borrado previo (`removeDemo.ts`): nunca se llama suelto.
import type { ITransactionClient } from "@/database/connection";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { DEFAULT_EMPLOYEE_FISCAL_VALUES } from "@/lib/payroll/satCatalogs";
import { buildDate } from "@/utils/date_helpper";
import {
  DEMO_BRANCH_NAME,
  DEMO_COMPANY_NAME,
  DEMO_EMPLOYEES,
  DEMO_PAYMENT_PERIOD_ID_WEEKLY,
  DEMO_SHIFT_ID_MORNING,
  DEMO_USER_EMAIL,
  DEMO_USER_NAME,
  DEMO_USER_ROLE_ID,
  type IDemoEmployeeFixture,
} from "./constants";

const PODOLOGIST_USER_ROLE_ID = 2;
const WORKED_WEEKDAYS = [1, 2, 3, 4, 5, 6] as const; // lunes a sábado; domingo es descanso

export interface ISeededDemoOrganization {
  id_empresa: number;
  id_sucursal: number;
  id_user_demo: number;
  employeeIdsByKey: Record<string, number>;
  /** "YYYY-MM-DD" de cada empleado, para que otros pasos no recalculen yearStart/midYear. */
  fechaIngresoByKey: Record<string, string>;
  /** id_user del usuario rol 2 vinculado, solo para las claves con `linkedUserRoleId !== null`. */
  linkedUserIdsByKey: Record<string, number>;
}

function resolveHireDate(hireDate: IDemoEmployeeFixture["hireDate"], year: number): string {
  return hireDate === "midYear" ? `${year}-07-01` : `${year}-01-02`;
}

/** CLABE ficticia de 18 dígitos, estable por secuencia; no corresponde a ninguna cuenta real. */
function buildFakeClabe(sequence: number): string {
  return `032${String(sequence).padStart(15, "0")}`;
}

async function insertDemoCompany(tx: ITransactionClient): Promise<number> {
  const [row] = (await tx.queryParams(
    `INSERT INTO [CentroPodologico].[dbo].[empresas] ([id_empresa], [nombre], [telefono], [email], [created_at], [status])
     OUTPUT INSERTED.[id_empresa]
     VALUES (
       (SELECT ISNULL(MAX([id_empresa]), 0) + 1 FROM [CentroPodologico].[dbo].[empresas]),
       @nombre, @telefono, @email, @created_at, 1
     )`,
    {
      nombre: DEMO_COMPANY_NAME,
      telefono: "7820000000",
      email: DEMO_USER_EMAIL,
      created_at: buildDate(new Date()),
    },
  )) as { id_empresa: number }[];
  return row.id_empresa;
}

async function insertDemoBranch(tx: ITransactionClient, id_empresa: number): Promise<number> {
  const [row] = (await tx.queryParams(
    `INSERT INTO [CentroPodologico].[dbo].[sucursales]
       ([id_sucursal], [id_empresa], [nombre], [ciudad], [direccion], [telefono], [activo], [created_at], [status], [id_state])
     OUTPUT INSERTED.[id_sucursal]
     VALUES (
       (SELECT ISNULL(MAX([id_sucursal]), 0) + 1 FROM [CentroPodologico].[dbo].[sucursales]),
       @id_empresa, @nombre, @ciudad, @direccion, @telefono, 1, @created_at, 1, @id_state
     )`,
    {
      id_empresa,
      nombre: DEMO_BRANCH_NAME,
      ciudad: "Ciudad Demo",
      direccion: "Av. Demostración 100, Col. Centro",
      telefono: "7820000001",
      created_at: buildDate(new Date()),
      id_state: 30, // Veracruz, reutilizado de los estados ya sembrados en Cat_states
    },
  )) as { id_sucursal: number }[];
  return row.id_sucursal;
}

async function insertUser(
  tx: ITransactionClient,
  params: {
    nombre: string;
    email: string;
    telefono: string;
    password_hash: string;
    id_role: number;
    id_sucursal: number;
    id_empresa: number;
    id_empleado: number | null;
  },
): Promise<number> {
  const [row] = (await tx.queryParams(
    `INSERT INTO [CentroPodologico].[dbo].[users]
       ([id_user], [nombre], [email], [telefono], [password_hash], [id_role],
        [status], [created_at], [id_sucursal], [id_empresa], [sucursales_string], [id_empleado])
     OUTPUT INSERTED.[id_user]
     VALUES (
       (SELECT ISNULL(MAX([id_user]), 0) + 1 FROM [CentroPodologico].[dbo].[users]),
       @nombre, @email, @telefono, @password_hash, @id_role,
       1, @created_at, @id_sucursal, @id_empresa, @sucursales_string, @id_empleado
     )`,
    {
      ...params,
      sucursales_string: String(params.id_sucursal),
      created_at: buildDate(new Date()),
    },
  )) as { id_user: number }[];
  return row.id_user;
}

async function insertEmployee(
  tx: ITransactionClient,
  fixture: IDemoEmployeeFixture,
  context: { id_empresa: number; id_sucursal: number; codigo_empleado: string; fecha_ingreso: string; cuenta_bancaria: string },
): Promise<number> {
  const [row] = (await tx.queryParams(
    `INSERT INTO [CentroPodologico].[RH].[empleados]
       ([codigo_empleado], [id_empresa], [id_sucursal], [nombre], [apellido_paterno], [apellido_materno],
        [fecha_ingreso], [email], [rfc], [curp], [nss], [fecha_nacimiento], [genero], [estado_civil],
        [id_department], [id_puesto], [id_turno], [id_periodo_pago],
        [salario_diario], [salario_diario_fiscal], [tipo_salario], [cuenta_bancaria],
        [codigo_postal_fiscal], [tipo_regimen], [tipo_contrato], [tipo_jornada], [sindicalizado], [categoria_ptu],
        [activo], [status], [created_at])
     OUTPUT INSERTED.[id_empleado]
     VALUES
       (@codigo_empleado, @id_empresa, @id_sucursal, @nombre, @apellido_paterno, @apellido_materno,
        @fecha_ingreso, @email, @rfc, @curp, @nss, @fecha_nacimiento, @genero, @estado_civil,
        @id_department, @id_puesto, @id_turno, @id_periodo_pago,
        @salario_diario, @salario_diario_fiscal, @tipo_salario, @cuenta_bancaria,
        @codigo_postal_fiscal, @tipo_regimen, @tipo_contrato, @tipo_jornada, @sindicalizado, @categoria_ptu,
        1, 1, @created_at)`,
    {
      codigo_empleado: context.codigo_empleado,
      id_empresa: context.id_empresa,
      id_sucursal: context.id_sucursal,
      nombre: fixture.firstName,
      apellido_paterno: fixture.lastNamePaterno,
      apellido_materno: fixture.lastNameMaterno,
      fecha_ingreso: context.fecha_ingreso,
      email: `${fixture.key}@centropodologico.test`,
      rfc: fixture.rfc,
      curp: fixture.curp,
      nss: fixture.nss,
      fecha_nacimiento: fixture.fechaNacimiento,
      genero: fixture.genero,
      estado_civil: "soltero",
      id_department: fixture.idDepartment,
      id_puesto: fixture.idPuesto,
      id_turno: DEMO_SHIFT_ID_MORNING,
      id_periodo_pago: DEMO_PAYMENT_PERIOD_ID_WEEKLY,
      salario_diario: fixture.dailySalary,
      salario_diario_fiscal: fixture.dailyFiscalSalary,
      tipo_salario: fixture.role === "podologist" ? "mixto" : "fijo",
      cuenta_bancaria: context.cuenta_bancaria,
      codigo_postal_fiscal: "93290",
      ...DEFAULT_EMPLOYEE_FISCAL_VALUES,
      categoria_ptu: fixture.ptuCategory,
      created_at: buildDate(new Date()),
    },
  )) as { id_empleado: number }[];
  return row.id_empleado;
}

async function insertEmployeeSchedule(tx: ITransactionClient, id_empleado: number): Promise<void> {
  const created_at = buildDate(new Date());
  for (const dia_semana of WORKED_WEEKDAYS) {
    await tx.queryParams(
      `INSERT INTO [CentroPodologico].[RH].[empleado_horarios]
         ([id_empleado], [dia_semana], [hora_entrada_1], [hora_salida_1], [created_at])
       VALUES (@id_empleado, @dia_semana, '09:00', '18:00', @created_at)`,
      { id_empleado, dia_semana, created_at },
    );
  }
}

async function insertEmployeeSbc(
  tx: ITransactionClient,
  params: { id_empleado: number; sbc: number; vigente_desde: string; updated_by: number },
): Promise<void> {
  const updated_at = buildDate(new Date());
  await tx.queryParams(
    `INSERT INTO [CentroPodologico].[RH].[employee_sbc] (id_empleado, sbc, vigente_desde, updated_by, updated_at)
     VALUES (@id_empleado, @sbc, @vigente_desde, @updated_by, @updated_at)`,
    { ...params, updated_at },
  );
  await tx.queryParams(
    `INSERT INTO [CentroPodologico].[RH].[employee_sbc_log] (id_empleado, vigente_desde, sbc_anterior, sbc_nuevo, updated_by, updated_at)
     VALUES (@id_empleado, @vigente_desde, NULL, @sbc, @updated_by, @updated_at)`,
    { ...params, updated_at },
  );
}

/**
 * Crea la Empresa Demo completa dentro de `tx`. `demoUserPasswordHash` es la contraseña del
 * usuario demo (spec: `DEMO_USER_PASSWORD`); los 3 usuarios rol 2 vinculados a los podólogos
 * reciben una contraseña aleatoria distinta, para que ninguno pueda entrar con esa variable.
 */
export async function seedOrganization(
  tx: ITransactionClient,
  demoUserPasswordHash: string,
): Promise<ISeededDemoOrganization> {
  const id_empresa = await insertDemoCompany(tx);
  const id_sucursal = await insertDemoBranch(tx, id_empresa);

  const id_user_demo = await insertUser(tx, {
    nombre: DEMO_USER_NAME,
    email: DEMO_USER_EMAIL,
    telefono: "7820000000",
    password_hash: demoUserPasswordHash,
    id_role: DEMO_USER_ROLE_ID,
    id_sucursal,
    id_empresa,
    id_empleado: null,
  });

  const year = Number(buildDate(new Date()).slice(0, 4));
  const employeeIdsByKey: Record<string, number> = {};
  const fechaIngresoByKey: Record<string, string> = {};
  const linkedUserIdsByKey: Record<string, number> = {};

  for (const [index, fixture] of DEMO_EMPLOYEES.entries()) {
    const sequence = index + 1;
    const fecha_ingreso = resolveHireDate(fixture.hireDate, year);
    // "EMP-DEMO-NNN": codigo_empleado es único en toda la tabla (UQ_empleados_codigo), no por
    // empresa, así que no puede seguir el patrón "EMP-{año}-{NNN}" de la empresa real sin arriesgar
    // una colisión con sus códigos ya existentes.
    const id_empleado = await insertEmployee(tx, fixture, {
      id_empresa,
      id_sucursal,
      codigo_empleado: `EMP-DEMO-${String(sequence).padStart(3, "0")}`,
      fecha_ingreso,
      cuenta_bancaria: buildFakeClabe(sequence),
    });
    employeeIdsByKey[fixture.key] = id_empleado;
    fechaIngresoByKey[fixture.key] = fecha_ingreso;

    await insertEmployeeSchedule(tx, id_empleado);
    await insertEmployeeSbc(tx, {
      id_empleado,
      sbc: fixture.sbc,
      vigente_desde: fecha_ingreso,
      updated_by: id_user_demo,
    });

    if (fixture.linkedUserRoleId !== null) {
      const unreachablePassword = await bcrypt.hash(randomUUID(), 10);
      const id_user_linked = await insertUser(tx, {
        nombre: `${fixture.firstName} ${fixture.lastNamePaterno} ${fixture.lastNameMaterno}`.trim(),
        email: `${fixture.key}@centropodologico.test`,
        telefono: "7820000000",
        password_hash: unreachablePassword,
        id_role: fixture.linkedUserRoleId ?? PODOLOGIST_USER_ROLE_ID,
        id_sucursal,
        id_empresa,
        id_empleado,
      });
      linkedUserIdsByKey[fixture.key] = id_user_linked;
    }
  }

  return { id_empresa, id_sucursal, id_user_demo, employeeIdsByKey, fechaIngresoByKey, linkedUserIdsByKey };
}
