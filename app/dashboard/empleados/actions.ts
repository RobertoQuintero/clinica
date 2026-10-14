"use server";

import db from "@/database/connection";
import { IAuthUser } from "@/interfaces/auth";
import {
  IEmployee,
  IEmployeeListItem,
  IEmployeeRecord,
  EmployeeFormInput,
} from "@/interfaces/employee";
import { IBank, IDepartment, IPosition, IShift, IPaymentPeriod } from "@/interfaces/rh_catalogs";
import { ISucursal } from "@/interfaces/sucursal";
import { getSucursalesForUser } from "@/app/dashboard/sucursales/actions";
import { toDBString, buildDate, addZeroToday } from "@/utils/date_helpper";
import { syncVacationEntitlements } from "@/lib/vacations/entitlementSync";
import { getVacationBadgeSummary, type VacationBadgeInput } from "@/lib/vacations/vacationStatus";
import { parseEmployeeInput } from "./schemas";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

/** Fila mínima para poblar el `<select>` de supervisor del modal. */
export interface IEmployeeSupervisorOption {
  id_empleado: number;
  nombre_completo: string;
}

export interface IEmployeeCatalogs {
  departments: IDepartment[];
  positions: IPosition[];
  shifts: IShift[];
  paymentPeriods: IPaymentPeriod[];
  banks: IBank[];
  sucursales: ISucursal[];
  supervisors: IEmployeeSupervisorOption[];
}

async function getActiveUser(): Promise<IAuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) throw new Error("No autenticado");
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as IAuthUser;
}

/** nombre + apellido_paterno + apellido_materno, con un solo espacio entre partes no vacías. */
function buildFullName(
  nombre: string,
  apellido_paterno: string | null,
  apellido_materno: string | null
): string {
  return [nombre, apellido_paterno, apellido_materno]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" ");
}

/** Convierte `sucursales_string` ("1,2,3") en enteros válidos; ids no numéricos se descartan. */
function parseSucursalIds(sucursalesString: string | null | undefined): number[] {
  return (sucursalesString ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/** Arma los parámetros `@suc0, @suc1, …` para un `IN (...)` seguro a partir de sucursales_string. */
function buildSucursalInParams(sucursalesString: string | null | undefined) {
  const ids = parseSucursalIds(sucursalesString);
  const placeholders = ids.map((_, i) => `@suc${i}`).join(", ");
  const params: Record<string, number> = {};
  ids.forEach((id, i) => {
    params[`suc${i}`] = id;
  });
  return { ids, placeholders, params };
}

const EMPLOYEE_SELECT_COLUMNS = `
            e.[id_empleado],
            e.[codigo_empleado],
            e.[id_empresa],
            e.[id_sucursal],
            e.[nombre],
            e.[apellido_paterno],
            e.[apellido_materno],
            e.[foto_url],
            CONVERT(varchar(10), e.[fecha_ingreso], 120) AS fecha_ingreso,
            e.[id_supervisor],
            e.[whatsapp],
            e.[email],
            e.[rfc],
            e.[curp],
            e.[nss],
            CONVERT(varchar(10), e.[fecha_nacimiento], 120) AS fecha_nacimiento,
            e.[genero],
            e.[estado_civil],
            e.[direccion],
            e.[contacto_emergencia],
            e.[whatsapp_emergencia],
            e.[contacto_emergencia_2],
            e.[whatsapp_emergencia_2],
            e.[id_department],
            e.[id_puesto],
            e.[id_turno],
            e.[id_periodo_pago],
            e.[dias_laborales],
            e.[horario],
            e.[salario_diario],
            e.[salario_diario_fiscal],
            e.[tipo_salario],
            e.[cuenta_bancaria],
            e.[codigo_postal_fiscal],
            e.[tipo_regimen],
            e.[tipo_contrato],
            e.[tipo_jornada],
            e.[sindicalizado],
            e.[banco],
            e.[activo],
            e.[status],
            CONVERT(varchar(19), e.[created_at], 120) AS created_at,
            CONVERT(varchar(19), e.[updated_at], 120) AS updated_at,
            d.[name] AS nombre_departamento,
            p.[name] AS nombre_puesto,
            s.[nombre] AS nombre_sucursal`;

/** Todos los empleados con `status = 1` de las sucursales a las que el usuario tiene acceso. */
export async function getEmployees(): Promise<IEmployeeListItem[]> {
  const { id_empresa, sucursales_string } = await getActiveUser();
  const { ids, placeholders, params } = buildSucursalInParams(sucursales_string);
  if (ids.length === 0) return [];

  // Genera los años de vacaciones que falten (spec 76) antes de leer el año vigente de cada fila.
  await syncVacationEntitlements(id_empresa);

  const data = (await db.queryParams(
    `SELECT ${EMPLOYEE_SELECT_COLUMNS},
            pp.[description] AS nombre_periodo_pago,
            vac.[id_vacation_entitlement] AS vac_id_vacation_entitlement,
            vac.[dias_derecho]            AS vac_dias_derecho,
            vac.[fecha_limite_solicitud]  AS vac_fecha_limite_solicitud,
            vac.[fecha_inicio]            AS vac_fecha_inicio,
            vac.[fecha_fin]               AS vac_fecha_fin,
            vac.[dias_tomados]            AS vac_dias_tomados,
            vac.[fecha_pago]              AS vac_fecha_pago,
            vac.[dias_pagados]            AS vac_dias_pagados
       FROM [CentroPodologico].[RH].[empleados] e
       JOIN [CentroPodologico].[RH].[departamentos] d ON d.[id_department] = e.[id_department]
       JOIN [CentroPodologico].[RH].[puestos] p ON p.[id_puesto] = e.[id_puesto]
       JOIN [CentroPodologico].[dbo].[sucursales] s ON s.[id_sucursal] = e.[id_sucursal]
       LEFT JOIN [CentroPodologico].[RH].[payment_periods] pp ON pp.[id_payment_period] = e.[id_periodo_pago]
       OUTER APPLY (
            SELECT TOP 1
                   v.[id_vacation_entitlement],
                   v.[dias_derecho],
                   CONVERT(varchar(10), v.[fecha_limite_solicitud], 120) AS fecha_limite_solicitud,
                   CONVERT(varchar(10), v.[fecha_inicio],           120) AS fecha_inicio,
                   CONVERT(varchar(10), v.[fecha_fin],              120) AS fecha_fin,
                   v.[dias_tomados],
                   CONVERT(varchar(10), v.[fecha_pago],             120) AS fecha_pago,
                   v.[dias_pagados]
              FROM [CentroPodologico].[RH].[vacation_entitlements] v
             WHERE v.[id_empleado] = e.[id_empleado]
             ORDER BY v.[anio_servicio] DESC
       ) vac
      WHERE e.[status] = 1
        AND e.[id_empresa] = @id_empresa
        AND e.[id_sucursal] IN (${placeholders})
      ORDER BY e.[activo] DESC, e.[apellido_paterno] ASC, e.[apellido_materno] ASC, e.[nombre] ASC`,
    { id_empresa, ...params }
  )) as (IEmployee & {
    nombre_departamento: string;
    nombre_puesto: string;
    nombre_sucursal: string;
    nombre_periodo_pago: string | null;
    vac_id_vacation_entitlement: number | null;
    vac_dias_derecho: number | null;
    vac_fecha_limite_solicitud: string | null;
    vac_fecha_inicio: string | null;
    vac_fecha_fin: string | null;
    vac_dias_tomados: number | null;
    vac_fecha_pago: string | null;
    vac_dias_pagados: number | null;
  })[];

  const today = addZeroToday(new Date());
  return data.map((row) => {
    const {
      vac_id_vacation_entitlement,
      vac_dias_derecho,
      vac_fecha_limite_solicitud,
      vac_fecha_inicio,
      vac_fecha_fin,
      vac_dias_tomados,
      vac_fecha_pago,
      vac_dias_pagados,
      ...employee
    } = row;

    // Sin fila en el OUTER APPLY el empleado aún no tiene año de derecho: sin badge.
    const currentYear: VacationBadgeInput | null =
      vac_id_vacation_entitlement === null
        ? null
        : {
            dias_derecho: vac_dias_derecho as number,
            fecha_limite_solicitud: vac_fecha_limite_solicitud as string,
            fecha_inicio: vac_fecha_inicio,
            fecha_fin: vac_fecha_fin,
            dias_tomados: vac_dias_tomados,
            fecha_pago: vac_fecha_pago,
            dias_pagados: vac_dias_pagados,
          };

    return {
      ...employee,
      nombre_completo: buildFullName(row.nombre, row.apellido_paterno, row.apellido_materno),
      vacation: currentYear ? getVacationBadgeSummary(currentYear, today) : null,
    };
  });
}

/** Expediente completo de un empleado. `null` si no pertenece a la empresa o a una sucursal del usuario. */
export async function getEmployeeById(id_empleado: number): Promise<IEmployeeRecord | null> {
  const { id_empresa, sucursales_string } = await getActiveUser();
  const { ids, placeholders, params } = buildSucursalInParams(sucursales_string);
  if (ids.length === 0) return null;

  const data = (await db.queryParams(
    `SELECT ${EMPLOYEE_SELECT_COLUMNS},
            t.[description] AS nombre_turno,
            pp.[description] AS nombre_periodo_pago,
            b.[nombre] AS nombre_banco,
            st.[state_key] AS clave_estado_sat,
            sup.[nombre] AS sup_nombre,
            sup.[apellido_paterno] AS sup_apellido_paterno,
            sup.[apellido_materno] AS sup_apellido_materno
       FROM [CentroPodologico].[RH].[empleados] e
       JOIN [CentroPodologico].[RH].[departamentos] d ON d.[id_department] = e.[id_department]
       JOIN [CentroPodologico].[RH].[puestos] p ON p.[id_puesto] = e.[id_puesto]
       JOIN [CentroPodologico].[dbo].[sucursales] s ON s.[id_sucursal] = e.[id_sucursal]
       LEFT JOIN [CentroPodologico].[RH].[turnos] t ON t.[id_turno] = e.[id_turno]
       LEFT JOIN [CentroPodologico].[RH].[payment_periods] pp ON pp.[id_payment_period] = e.[id_periodo_pago]
       LEFT JOIN [CentroPodologico].[RH].[cat_bancos] b ON b.[clave] = e.[banco]
       LEFT JOIN [CentroPodologico].[dbo].[Cat_states] st ON st.[id_state] = s.[id_state]
       LEFT JOIN [CentroPodologico].[RH].[empleados] sup ON sup.[id_empleado] = e.[id_supervisor]
      WHERE e.[id_empleado] = @id_empleado
        AND e.[id_empresa] = @id_empresa
        AND e.[id_sucursal] IN (${placeholders})`,
    { id_empleado, id_empresa, ...params }
  )) as (IEmployee & {
    nombre_departamento: string;
    nombre_puesto: string;
    nombre_sucursal: string;
    nombre_turno: string | null;
    nombre_periodo_pago: string | null;
    nombre_banco: string | null;
    clave_estado_sat: string | null;
    sup_nombre: string | null;
    sup_apellido_paterno: string | null;
    sup_apellido_materno: string | null;
  })[];

  const [row] = data;
  if (!row) return null;

  const { sup_nombre, sup_apellido_paterno, sup_apellido_materno, ...employee } = row;

  return {
    ...employee,
    nombre_completo: buildFullName(row.nombre, row.apellido_paterno, row.apellido_materno),
    nombre_supervisor: sup_nombre
      ? buildFullName(sup_nombre, sup_apellido_paterno, sup_apellido_materno)
      : null,
  };
}

/** Catálogos para poblar los `<select>` del modal de alta/edición, en una sola llamada. */
export async function getEmployeeCatalogs(): Promise<IEmployeeCatalogs> {
  const { id_empresa } = await getActiveUser();

  const [departments, positions, shifts, paymentPeriods, banks, sucursales, supervisors] = await Promise.all([
    db.queryParams(
      `SELECT [id_department], [name], [id_empresa], [status], [activo], [description]
         FROM [CentroPodologico].[RH].[departamentos]
        WHERE [status] = 1
          AND ([id_empresa] = @id_empresa OR [id_empresa] IS NULL)
        ORDER BY [name]`,
      { id_empresa }
    ) as Promise<IDepartment[]>,
    db.queryParams(
      `SELECT [id_puesto], [id_department], [name], [status], [activo], [description]
         FROM [CentroPodologico].[RH].[puestos]
        WHERE [status] = 1
        ORDER BY [id_department], [name]`,
      {}
    ) as Promise<IPosition[]>,
    db.queryParams(
      `SELECT [id_turno], [description], [status]
         FROM [CentroPodologico].[RH].[turnos]
        WHERE [status] = 1
        ORDER BY [id_turno]`,
      {}
    ) as Promise<IShift[]>,
    db.queryParams(
      `SELECT [id_payment_period], [clave_sat], [description], [days], [status]
         FROM [CentroPodologico].[RH].[payment_periods]
        WHERE [status] = 1
        ORDER BY [id_payment_period]`,
      {}
    ) as Promise<IPaymentPeriod[]>,
    db.queryParams(
      `SELECT [clave], [nombre], [razon_social], [status]
         FROM [CentroPodologico].[RH].[cat_bancos]
        WHERE [status] = 1
        ORDER BY [nombre]`,
      {}
    ) as Promise<IBank[]>,
    getSucursalesForUser(),
    db.queryParams(
      `SELECT [id_empleado], [nombre], [apellido_paterno], [apellido_materno]
         FROM [CentroPodologico].[RH].[empleados]
        WHERE [status] = 1
          AND [activo] = 1
          AND [id_empresa] = @id_empresa
        ORDER BY [apellido_paterno], [apellido_materno], [nombre]`,
      { id_empresa }
    ) as Promise<{ id_empleado: number; nombre: string; apellido_paterno: string | null; apellido_materno: string | null }[]>,
  ]);

  return {
    departments,
    positions,
    shifts,
    paymentPeriods,
    banks,
    sucursales,
    supervisors: supervisors.map((row) => ({
      id_empleado: row.id_empleado,
      nombre_completo: buildFullName(row.nombre, row.apellido_paterno, row.apellido_materno),
    })),
  };
}

const FECHA_INGRESO_REQUIRED_MESSAGE = "La fecha de ingreso es obligatoria";

/** Consecutivo `EMP-{YYYY}-{NNN}` por año de ingreso y por empresa. */
async function generateEmployeeCode(id_empresa: number, fechaIngresoDb: string): Promise<string> {
  const year = fechaIngresoDb.slice(0, 4);
  const prefix = `EMP-${year}-`;

  const rows = (await db.queryParams(
    `SELECT MAX(CAST(SUBSTRING([codigo_empleado], LEN(@prefix) + 1, 20) AS INT)) AS max_suffix
       FROM [CentroPodologico].[RH].[empleados]
      WHERE [id_empresa] = @id_empresa
        AND [codigo_empleado] LIKE @likePrefix`,
    { prefix, id_empresa, likePrefix: `${prefix}%` }
  )) as { max_suffix: number | null }[];

  const nextSequence = (rows[0]?.max_suffix ?? 0) + 1;
  return `${prefix}${String(nextSequence).padStart(3, "0")}`;
}

/** Parámetros comunes de INSERT/UPDATE derivados del formulario (sin campos generados/derivados). */
function buildEmployeeWriteParams(input: EmployeeFormInput, fechaIngresoDb: string) {
  return {
    id_sucursal: input.id_sucursal,
    nombre: input.nombre.trim(),
    apellido_paterno: input.apellido_paterno ?? null,
    apellido_materno: input.apellido_materno ?? null,
    foto_url: input.foto_url ?? null,
    fecha_ingreso: fechaIngresoDb,
    id_supervisor: input.id_supervisor ?? null,
    whatsapp: input.whatsapp ?? null,
    email: input.email ?? null,
    rfc: input.rfc ?? null,
    curp: input.curp ?? null,
    nss: input.nss ?? null,
    fecha_nacimiento: toDBString(String(input.fecha_nacimiento ?? "")),
    genero: input.genero ?? null,
    estado_civil: input.estado_civil ?? null,
    direccion: input.direccion ?? null,
    contacto_emergencia: input.contacto_emergencia ?? null,
    whatsapp_emergencia: input.whatsapp_emergencia ?? null,
    contacto_emergencia_2: input.contacto_emergencia_2 ?? null,
    whatsapp_emergencia_2: input.whatsapp_emergencia_2 ?? null,
    id_department: input.id_department,
    id_puesto: input.id_puesto,
    id_turno: input.id_turno ?? null,
    id_periodo_pago: input.id_periodo_pago ?? null,
    salario_diario: input.salario_diario ?? null,
    salario_diario_fiscal: input.salario_diario_fiscal ?? null,
    tipo_salario: input.tipo_salario ?? null,
    cuenta_bancaria: input.cuenta_bancaria ?? null,
    codigo_postal_fiscal: input.codigo_postal_fiscal ?? null,
    tipo_regimen: input.tipo_regimen ?? null,
    tipo_contrato: input.tipo_contrato ?? null,
    tipo_jornada: input.tipo_jornada ?? null,
    sindicalizado: input.sindicalizado ?? null,
    banco: input.banco ?? null,
  };
}

export async function createEmployee(rawInput: EmployeeFormInput): Promise<ActionResult<number>> {
  try {
    const parsedInput = parseEmployeeInput(rawInput);
    if (!parsedInput.ok) return { ok: false, message: parsedInput.message };
    const input = parsedInput.data;

    const { id_empresa } = await getActiveUser();
    const fechaIngresoDb = toDBString(String(input.fecha_ingreso ?? ""));
    if (!fechaIngresoDb) return { ok: false, message: FECHA_INGRESO_REQUIRED_MESSAGE };

    const codigo_empleado = await generateEmployeeCode(id_empresa, fechaIngresoDb);
    const writeParams = buildEmployeeWriteParams(input, fechaIngresoDb);

    const inserted = await db.queryParams(
      `INSERT INTO [CentroPodologico].[RH].[empleados]
         ([codigo_empleado],[id_empresa],[id_sucursal],[nombre],[apellido_paterno],[apellido_materno],
          [foto_url],[fecha_ingreso],[id_supervisor],[whatsapp],[email],[rfc],[curp],[nss],
          [fecha_nacimiento],[genero],[estado_civil],[direccion],[contacto_emergencia],[whatsapp_emergencia],
          [contacto_emergencia_2],[whatsapp_emergencia_2],
          [id_department],[id_puesto],[id_turno],[id_periodo_pago],
          [salario_diario],[salario_diario_fiscal],[tipo_salario],[cuenta_bancaria],
          [codigo_postal_fiscal],[tipo_regimen],[tipo_contrato],[tipo_jornada],[sindicalizado],[banco],
          [activo],[status],[created_at])
       OUTPUT INSERTED.[id_empleado]
       VALUES
         (@codigo_empleado,@id_empresa,@id_sucursal,@nombre,@apellido_paterno,@apellido_materno,
          @foto_url,@fecha_ingreso,@id_supervisor,@whatsapp,@email,@rfc,@curp,@nss,
          @fecha_nacimiento,@genero,@estado_civil,@direccion,@contacto_emergencia,@whatsapp_emergencia,
          @contacto_emergencia_2,@whatsapp_emergencia_2,
          @id_department,@id_puesto,@id_turno,@id_periodo_pago,
          @salario_diario,@salario_diario_fiscal,@tipo_salario,@cuenta_bancaria,
          @codigo_postal_fiscal,@tipo_regimen,@tipo_contrato,@tipo_jornada,@sindicalizado,@banco,
          1,1,@created_at)`,
      { ...writeParams, codigo_empleado, id_empresa, created_at: buildDate(new Date()) }
    );

    const newId = (inserted[0] as { id_empleado: number }).id_empleado;
    revalidatePath("/dashboard/empleados");
    return { ok: true, data: newId };
  } catch {
    return { ok: false, message: "Error al guardar el empleado" };
  }
}

export async function updateEmployee(
  id_empleado: number,
  rawInput: EmployeeFormInput
): Promise<ActionResult<null>> {
  try {
    const parsedInput = parseEmployeeInput(rawInput);
    if (!parsedInput.ok) return { ok: false, message: parsedInput.message };
    const input = parsedInput.data;

    const { id_empresa } = await getActiveUser();
    const fechaIngresoDb = toDBString(String(input.fecha_ingreso ?? ""));
    if (!fechaIngresoDb) return { ok: false, message: FECHA_INGRESO_REQUIRED_MESSAGE };

    const writeParams = buildEmployeeWriteParams(input, fechaIngresoDb);

    await db.queryParams(
      `UPDATE [CentroPodologico].[RH].[empleados] SET
         [id_sucursal]          = @id_sucursal,
         [nombre]               = @nombre,
         [apellido_paterno]     = @apellido_paterno,
         [apellido_materno]     = @apellido_materno,
         [foto_url]             = @foto_url,
         [fecha_ingreso]        = @fecha_ingreso,
         [id_supervisor]        = @id_supervisor,
         [whatsapp]             = @whatsapp,
         [email]                = @email,
         [rfc]                  = @rfc,
         [curp]                 = @curp,
         [nss]                  = @nss,
         [fecha_nacimiento]     = @fecha_nacimiento,
         [genero]               = @genero,
         [estado_civil]         = @estado_civil,
         [direccion]            = @direccion,
         [contacto_emergencia]  = @contacto_emergencia,
         [whatsapp_emergencia]  = @whatsapp_emergencia,
         [contacto_emergencia_2] = @contacto_emergencia_2,
         [whatsapp_emergencia_2] = @whatsapp_emergencia_2,
         [id_department]        = @id_department,
         [id_puesto]            = @id_puesto,
         [id_turno]             = @id_turno,
         [id_periodo_pago]      = @id_periodo_pago,
         [salario_diario]       = @salario_diario,
         [salario_diario_fiscal] = @salario_diario_fiscal,
         [tipo_salario]         = @tipo_salario,
         [cuenta_bancaria]      = @cuenta_bancaria,
         [codigo_postal_fiscal] = @codigo_postal_fiscal,
         [tipo_regimen]         = @tipo_regimen,
         [tipo_contrato]        = @tipo_contrato,
         [tipo_jornada]         = @tipo_jornada,
         [sindicalizado]        = @sindicalizado,
         [banco]                = @banco,
         [updated_at]           = @updated_at
       WHERE [id_empleado] = @id_empleado
         AND [id_empresa]  = @id_empresa`,
      { ...writeParams, id_empleado, id_empresa, updated_at: buildDate(new Date()) }
    );

    revalidatePath("/dashboard/empleados");
    revalidatePath(`/dashboard/empleados/${id_empleado}`);
    return { ok: true, data: null };
  } catch {
    return { ok: false, message: "Error al actualizar el empleado" };
  }
}

export async function setEmployeeActive(
  id_empleado: number,
  activo: boolean
): Promise<ActionResult<null>> {
  try {
    const { id_empresa } = await getActiveUser();
    await db.queryParams(
      `UPDATE [CentroPodologico].[RH].[empleados]
          SET [activo] = @activo, [updated_at] = @updated_at
        WHERE [id_empleado] = @id_empleado
          AND [id_empresa]  = @id_empresa`,
      { id_empleado, activo, id_empresa, updated_at: buildDate(new Date()) }
    );
    revalidatePath("/dashboard/empleados");
    revalidatePath(`/dashboard/empleados/${id_empleado}`);
    return { ok: true, data: null };
  } catch {
    return { ok: false, message: "Error al cambiar el estatus del empleado" };
  }
}
