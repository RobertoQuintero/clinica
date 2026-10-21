"use server";

import db from "@/database/connection";
import { getEmployeeById } from "@/app/dashboard/empleados/actions";
import type { IEmployeeSbc, IEmployeeSbcLogEntry } from "@/interfaces/employee_sbc";
import type { ITaxParameter } from "@/interfaces/payroll_tax_parameters";
import { ActionResult, assertPayrollAccess } from "@/lib/payroll/access";
import { EMPLOYEE_SBC_LOG_PAGE_SIZE } from "@/lib/payroll/constants";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import { createEmployeeSbcSchema, deleteEmployeeSbcSchema, updateEmployeeSbcSchema } from "./schemas";

const SBC_NOT_FOUND_MARKER = "EMPLOYEE_SBC_NOT_FOUND";
const BEFORE_HIRE_DATE_MARKER = "EMPLOYEE_SBC_BEFORE_HIRE_DATE";
const DUPLICATE_EFFECTIVE_DATE_MARKER = "EMPLOYEE_SBC_DUPLICATE_DATE";

function revalidateEmployeeSbcViews(id_empleado: number) {
  revalidatePath(`/dashboard/empleados/${id_empleado}/imss`);
}

/**
 * Gate común: rol de nómina (1 y 4) y empleado visible para el usuario (empresa y sucursales).
 * Devuelve el id del usuario que escribe la bitácora.
 */
async function assertEmployeeSbcAccess(id_empleado: number): Promise<ActionResult<{ id_user: number }>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  const employee = await getEmployeeById(id_empleado);
  if (!employee) return { ok: false, message: "No se encontró el empleado" };

  return { ok: true, data: { id_user: access.data.id_user } };
}

/** Historial del SBC del empleado, del más reciente al más antiguo. */
export async function getEmployeeSbcHistory(id_empleado: number): Promise<ActionResult<IEmployeeSbc[]>> {
  const access = await assertEmployeeSbcAccess(id_empleado);
  if (!access.ok) return access;

  try {
    const rows = await db.queryParams(
      `SELECT s.id_employee_sbc,
              s.id_empleado,
              CAST(s.sbc AS float)                       AS sbc,
              CONVERT(varchar(10), s.vigente_desde, 120) AS vigente_desde,
              ISNULL(u.nombre, '')                       AS updated_by_name,
              CONVERT(varchar(19), s.updated_at, 120)    AS updated_at
         FROM [CentroPodologico].[RH].[employee_sbc] s
         LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = s.updated_by
        WHERE s.id_empleado = @id_empleado
        ORDER BY s.vigente_desde DESC`,
      { id_empleado },
    );
    return { ok: true, data: rows as IEmployeeSbc[] };
  } catch (error) {
    console.error("getEmployeeSbcHistory", error);
    return { ok: false, message: "No se pudo cargar el historial del SBC" };
  }
}

/** Las últimas 20 entradas de la bitácora del SBC del empleado. */
export async function getEmployeeSbcLog(id_empleado: number): Promise<ActionResult<IEmployeeSbcLogEntry[]>> {
  const access = await assertEmployeeSbcAccess(id_empleado);
  if (!access.ok) return access;

  try {
    const rows = await db.queryParams(
      `SELECT TOP (@limit)
              l.id_log,
              CONVERT(varchar(10), l.vigente_desde, 120) AS vigente_desde,
              CAST(l.sbc_anterior AS float)              AS sbc_anterior,
              CAST(l.sbc_nuevo AS float)                 AS sbc_nuevo,
              ISNULL(u.nombre, '')                       AS updated_by_name,
              CONVERT(varchar(19), l.updated_at, 120)    AS updated_at
         FROM [CentroPodologico].[RH].[employee_sbc_log] l
         LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = l.updated_by
        WHERE l.id_empleado = @id_empleado
        ORDER BY l.updated_at DESC, l.id_log DESC`,
      { id_empleado, limit: EMPLOYEE_SBC_LOG_PAGE_SIZE },
    );
    return { ok: true, data: rows as IEmployeeSbcLogEntry[] };
  } catch (error) {
    console.error("getEmployeeSbcLog", error);
    return { ok: false, message: "No se pudo cargar la bitácora del SBC" };
  }
}

type MinimumWageRow = Pick<ITaxParameter, "clave" | "valor" | "vigente_desde">;

/** Todas las vigencias del salario mínimo general, para el aviso ámbar del modal (se compara a la vigencia capturada). */
export async function getMinimumWageParameters(): Promise<ActionResult<MinimumWageRow[]>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  try {
    const rows = await db.query(
      `SELECT clave,
              CAST(valor AS float)                     AS valor,
              CONVERT(varchar(10), vigente_desde, 120) AS vigente_desde
         FROM [CentroPodologico].[payroll].[tax_parameters]
        WHERE clave = 'SALARIO_MINIMO_GENERAL'
        ORDER BY vigente_desde`,
    );
    return { ok: true, data: rows as MinimumWageRow[] };
  } catch (error) {
    console.error("getMinimumWageParameters", error);
    return { ok: false, message: "No se pudo cargar el salario mínimo" };
  }
}

function describeSbcWriteError(error: unknown, fallbackMessage: string): string {
  const message = (error as { message?: string }).message ?? "";
  if (message.includes(BEFORE_HIRE_DATE_MARKER)) return "La vigencia no puede ser anterior a la fecha de ingreso del empleado";
  if (message.includes(DUPLICATE_EFFECTIVE_DATE_MARKER)) return "Ya existe un SBC con esa vigencia para el empleado";
  if (message.includes(SBC_NOT_FOUND_MARKER)) return "El SBC ya no existe";
  return fallbackMessage;
}

/**
 * Alta de un SBC. Valida en SQL (otra vez) que la vigencia no sea anterior al ingreso ni repetida, y escribe
 * la fila y su bitácora en la misma transacción.
 */
export async function createEmployeeSbc(input: unknown): Promise<ActionResult<null>> {
  const parsed = createEmployeeSbcSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { id_empleado, sbc, vigente_desde } = parsed.data;

  const access = await assertEmployeeSbcAccess(id_empleado);
  if (!access.ok) return access;

  try {
    await db.queryParams(
      `SET XACT_ABORT ON;
       BEGIN TRAN;

       DECLARE @new_sbc      decimal(12,2) = CAST(@sbc AS decimal(12,2));
       DECLARE @effective_on date          = CAST(@vigente_desde AS date);
       DECLARE @updated_at   datetime2(0)  = CAST(@updated_at_text AS datetime2(0));
       DECLARE @hire_date    date;

       SELECT @hire_date = fecha_ingreso
         FROM [CentroPodologico].[RH].[empleados] WITH (UPDLOCK, HOLDLOCK)
        WHERE id_empleado = @id_empleado;

       IF @effective_on < @hire_date
         THROW 50091, '${BEFORE_HIRE_DATE_MARKER}', 1;

       IF EXISTS (SELECT 1 FROM [CentroPodologico].[RH].[employee_sbc] WITH (UPDLOCK, HOLDLOCK)
                   WHERE id_empleado = @id_empleado AND vigente_desde = @effective_on)
         THROW 50092, '${DUPLICATE_EFFECTIVE_DATE_MARKER}', 1;

       INSERT INTO [CentroPodologico].[RH].[employee_sbc]
         (id_empleado, sbc, vigente_desde, updated_by, updated_at)
       VALUES (@id_empleado, @new_sbc, @effective_on, @updated_by, @updated_at);

       INSERT INTO [CentroPodologico].[RH].[employee_sbc_log]
         (id_empleado, vigente_desde, sbc_anterior, sbc_nuevo, updated_by, updated_at)
       VALUES (@id_empleado, @effective_on, NULL, @new_sbc, @updated_by, @updated_at);

       COMMIT;`,
      {
        id_empleado,
        sbc,
        vigente_desde,
        updated_by: access.data.id_user,
        updated_at_text: buildDate(new Date()),
      },
    );

    revalidateEmployeeSbcViews(id_empleado);
    return { ok: true, data: null };
  } catch (error) {
    console.error("createEmployeeSbc", error);
    return { ok: false, message: describeSbcWriteError(error, "No se pudo guardar el SBC") };
  }
}

/**
 * Edición del monto de un SBC (la vigencia no cambia). Un guardado sin cambios no escribe nada ni toca
 * `updated_at`. La vigencia ya cumplía `>= fecha_ingreso` al crearse.
 */
export async function updateEmployeeSbc(input: unknown): Promise<ActionResult<null>> {
  const parsed = updateEmployeeSbcSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { id_empleado, id_employee_sbc, sbc } = parsed.data;

  const access = await assertEmployeeSbcAccess(id_empleado);
  if (!access.ok) return access;

  try {
    await db.queryParams(
      `SET XACT_ABORT ON;
       BEGIN TRAN;

       DECLARE @new_sbc      decimal(12,2) = CAST(@sbc AS decimal(12,2));
       DECLARE @updated_at   datetime2(0)  = CAST(@updated_at_text AS datetime2(0));
       DECLARE @effective_on date, @previous_sbc decimal(12,2);

       SELECT @effective_on = vigente_desde, @previous_sbc = sbc
         FROM [CentroPodologico].[RH].[employee_sbc] WITH (UPDLOCK, HOLDLOCK)
        WHERE id_employee_sbc = @id_employee_sbc AND id_empleado = @id_empleado;

       IF @effective_on IS NULL
         THROW 50093, '${SBC_NOT_FOUND_MARKER}', 1;

       IF @previous_sbc = @new_sbc
       BEGIN
         COMMIT;
         RETURN;
       END

       UPDATE [CentroPodologico].[RH].[employee_sbc]
          SET sbc = @new_sbc, updated_by = @updated_by, updated_at = @updated_at
        WHERE id_employee_sbc = @id_employee_sbc;

       INSERT INTO [CentroPodologico].[RH].[employee_sbc_log]
         (id_empleado, vigente_desde, sbc_anterior, sbc_nuevo, updated_by, updated_at)
       VALUES (@id_empleado, @effective_on, @previous_sbc, @new_sbc, @updated_by, @updated_at);

       COMMIT;`,
      {
        id_empleado,
        id_employee_sbc,
        sbc,
        updated_by: access.data.id_user,
        updated_at_text: buildDate(new Date()),
      },
    );

    revalidateEmployeeSbcViews(id_empleado);
    return { ok: true, data: null };
  } catch (error) {
    console.error("updateEmployeeSbc", error);
    return { ok: false, message: describeSbcWriteError(error, "No se pudo guardar el SBC") };
  }
}

/** Borra un SBC y deja la baja en la bitácora (`sbc_nuevo` NULL), en una sola transacción. */
export async function deleteEmployeeSbc(input: unknown): Promise<ActionResult<null>> {
  const parsed = deleteEmployeeSbcSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { id_empleado, id_employee_sbc } = parsed.data;

  const access = await assertEmployeeSbcAccess(id_empleado);
  if (!access.ok) return access;

  try {
    await db.queryParams(
      `SET XACT_ABORT ON;
       BEGIN TRAN;

       DECLARE @updated_at   datetime2(0) = CAST(@updated_at_text AS datetime2(0));
       DECLARE @effective_on date, @previous_sbc decimal(12,2);

       SELECT @effective_on = vigente_desde, @previous_sbc = sbc
         FROM [CentroPodologico].[RH].[employee_sbc] WITH (UPDLOCK, HOLDLOCK)
        WHERE id_employee_sbc = @id_employee_sbc AND id_empleado = @id_empleado;

       IF @effective_on IS NULL
         THROW 50093, '${SBC_NOT_FOUND_MARKER}', 1;

       DELETE FROM [CentroPodologico].[RH].[employee_sbc]
        WHERE id_employee_sbc = @id_employee_sbc;

       INSERT INTO [CentroPodologico].[RH].[employee_sbc_log]
         (id_empleado, vigente_desde, sbc_anterior, sbc_nuevo, updated_by, updated_at)
       VALUES (@id_empleado, @effective_on, @previous_sbc, NULL, @updated_by, @updated_at);

       COMMIT;`,
      {
        id_empleado,
        id_employee_sbc,
        updated_by: access.data.id_user,
        updated_at_text: buildDate(new Date()),
      },
    );

    revalidateEmployeeSbcViews(id_empleado);
    return { ok: true, data: null };
  } catch (error) {
    console.error("deleteEmployeeSbc", error);
    return { ok: false, message: describeSbcWriteError(error, "No se pudo eliminar el SBC") };
  }
}
