"use server";

import db from "@/database/connection";
import { getEmployeeById } from "@/app/dashboard/empleados/actions";
import type { IEmployeeTermination, ITerminationCause } from "@/interfaces/employee_termination";
import { fetchEmployeeTerminations } from "@/lib/terminations/terminationQueries";
import { assertVacationAccess } from "@/lib/vacations/vacationAccess";
import { addZeroToday, buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import { registerEmployeeTerminationSchema } from "./schemas";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

/** Corta la transacción con un mensaje para el usuario; el `catch` externo lo convierte en `ok: false`. */
class TerminationRuleError extends Error {}

/** Violación de índice único (2601) o de restricción única (2627) de SQL Server. */
function isUniqueViolation(error: unknown): boolean {
  const sqlErrorNumber = (error as { number?: number } | null)?.number;
  return sqlErrorNumber === 2601 || sqlErrorNumber === 2627;
}

/** "YYYY-MM-DD" → "dd/mm/aaaa" para los mensajes. */
function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/** Causas de baja activas del catálogo IMSS/IDSE, en el orden de la clave. */
export async function getTerminationCauses(): Promise<ITerminationCause[]> {
  return (await db.queryParams(
    `SELECT [clave], [nombre], [tipo_terminacion_sugerido]
       FROM [CentroPodologico].[RH].[cat_causas_baja]
      WHERE [status] = 1
      ORDER BY [clave]`,
    {}
  )) as ITerminationCause[];
}

/** Bajas del empleado (vigente y anuladas), de la más reciente a la más antigua. */
export async function getEmployeeTerminations(
  id_empleado: number
): Promise<IEmployeeTermination[]> {
  // getEmployeeById valida empresa y sucursales del usuario; sin acceso no se expone nada.
  const employee = await getEmployeeById(id_empleado);
  if (!employee) return [];
  return fetchEmployeeTerminations(id_empleado);
}

/** Usuarios vinculados y PINs de checador activos del empleado: solo informativo para el modal de baja. */
export interface ITerminationWarnings {
  linkedUsers: number;
  activeIdentifiers: number;
}

export async function getTerminationWarnings(
  id_empleado: number
): Promise<ITerminationWarnings> {
  const employee = await getEmployeeById(id_empleado);
  if (!employee) return { linkedUsers: 0, activeIdentifiers: 0 };

  const [counts] = (await db.queryParams(
    `SELECT (SELECT COUNT(*) FROM [CentroPodologico].[dbo].[users]
              WHERE [id_empleado] = @id_empleado AND [status] = 1) AS linkedUsers,
            (SELECT COUNT(*) FROM [CentroPodologico].[RH].[empleado_identificadores]
              WHERE [id_empleado] = @id_empleado AND [status] = 1) AS activeIdentifiers`,
    { id_empleado }
  )) as ITerminationWarnings[];
  return counts;
}

/**
 * Registra la baja (spec 86) y deja `activo = 0` en la misma transacción. Acepta también a un
 * inactivo sin baja registrada (fecha pasada): en ese caso `activo` ya era 0. Las reglas de fecha
 * y pendientes se revisan dentro de la transacción, con el empleado bloqueado (`UPDLOCK`).
 */
export async function registerEmployeeTermination(
  input: unknown
): Promise<ActionResult<{ id_employee_termination: number }>> {
  try {
    const access = await assertVacationAccess();
    if (!access.ok) return access;

    const parsed = registerEmployeeTerminationSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const { id_empleado, fecha_baja, clave_causa, tipo_terminacion, observaciones } = parsed.data;

    // getEmployeeById valida empresa y sucursales del usuario.
    const employee = await getEmployeeById(id_empleado);
    if (!employee) return { ok: false, message: "El empleado no existe o no tienes acceso a él" };

    const today = addZeroToday(new Date());

    const terminationId = await db.transaction(async (tx) => {
      const [lockedEmployee] = (await tx.queryParams(
        `SELECT CONVERT(varchar(10), [fecha_ingreso], 120) AS fecha_ingreso
           FROM [CentroPodologico].[RH].[empleados] WITH (UPDLOCK, HOLDLOCK)
          WHERE [id_empleado] = @id_empleado`,
        { id_empleado }
      )) as { fecha_ingreso: string }[];
      if (!lockedEmployee) throw new TerminationRuleError("El empleado no existe");

      if (fecha_baja > today) {
        throw new TerminationRuleError("La fecha de baja no puede ser posterior a hoy");
      }
      if (fecha_baja < lockedEmployee.fecha_ingreso) {
        throw new TerminationRuleError(
          `La fecha de baja no puede ser anterior a la fecha de ingreso (${formatIsoDate(lockedEmployee.fecha_ingreso)})`
        );
      }

      const [existingTermination] = (await tx.queryParams(
        `SELECT TOP 1 1 AS has_termination
           FROM [CentroPodologico].[RH].[employee_terminations]
          WHERE [id_empleado] = @id_empleado AND [anulado_at] IS NULL`,
        { id_empleado }
      )) as { has_termination: number }[];
      if (existingTermination) {
        throw new TerminationRuleError("El empleado ya tiene una baja vigente");
      }

      const [cause] = (await tx.queryParams(
        `SELECT TOP 1 1 AS cause_exists
           FROM [CentroPodologico].[RH].[cat_causas_baja]
          WHERE [clave] = @clave_causa AND [status] = 1`,
        { clave_causa }
      )) as { cause_exists: number }[];
      if (!cause) throw new TerminationRuleError("Causa de baja inválida");

      const [pendingVacation] = (await tx.queryParams(
        `SELECT TOP 1 CONVERT(varchar(10), [fecha_inicio], 120) AS fecha_inicio,
                      CONVERT(varchar(10), [fecha_fin], 120)    AS fecha_fin
           FROM [CentroPodologico].[RH].[vacation_entitlements]
          WHERE [id_empleado] = @id_empleado
            AND [fecha_inicio] IS NOT NULL
            AND [fecha_fin] > @fecha_baja
          ORDER BY [fecha_inicio]`,
        { id_empleado, fecha_baja }
      )) as { fecha_inicio: string; fecha_fin: string }[];
      if (pendingVacation) {
        throw new TerminationRuleError(
          `Tiene vacaciones del ${formatIsoDate(pendingVacation.fecha_inicio)} al ${formatIsoDate(pendingVacation.fecha_fin)}, posteriores a la baja. Cancélalas o reprográmalas antes.`
        );
      }

      const [pendingEconomicDay] = (await tx.queryParams(
        `SELECT TOP 1 CONVERT(varchar(10), [fecha], 120) AS fecha
           FROM [CentroPodologico].[RH].[economic_days]
          WHERE [id_empleado] = @id_empleado
            AND [cancelado_at] IS NULL
            AND [fecha] > @fecha_baja
          ORDER BY [fecha]`,
        { id_empleado, fecha_baja }
      )) as { fecha: string }[];
      if (pendingEconomicDay) {
        throw new TerminationRuleError(
          `Tiene un día económico el ${formatIsoDate(pendingEconomicDay.fecha)}, posterior a la baja. Cancélalo antes.`
        );
      }

      const now = buildDate(new Date());
      const insertedRows = (await tx.queryParams(
        `INSERT INTO [CentroPodologico].[RH].[employee_terminations]
           ([id_empleado], [fecha_baja], [clave_causa], [tipo_terminacion], [observaciones],
            [registrado_by], [registrado_at])
         OUTPUT INSERTED.[id_employee_termination]
         VALUES (@id_empleado, @fecha_baja, @clave_causa, @tipo_terminacion, @observaciones,
                 @id_user, @registrado_at)`,
        {
          id_empleado,
          fecha_baja,
          clave_causa,
          tipo_terminacion,
          observaciones,
          id_user: access.data.id_user,
          registrado_at: now,
        }
      )) as { id_employee_termination: number }[];

      const deactivatedRows = (await tx.queryParams(
        `UPDATE [CentroPodologico].[RH].[empleados]
            SET [activo] = 0, [updated_at] = @updated_at
         OUTPUT INSERTED.[id_empleado]
          WHERE [id_empleado] = @id_empleado`,
        { id_empleado, updated_at: now }
      )) as { id_empleado: number }[];

      if (insertedRows.length === 0 || deactivatedRows.length === 0) {
        throw new TerminationRuleError("No se pudo registrar la baja");
      }
      return insertedRows[0].id_employee_termination;
    });

    revalidatePath("/dashboard/empleados");
    revalidatePath(`/dashboard/empleados/${id_empleado}`, "layout");
    return { ok: true, data: { id_employee_termination: terminationId } };
  } catch (error) {
    if (error instanceof TerminationRuleError) return { ok: false, message: error.message };
    if (isUniqueViolation(error)) {
      return { ok: false, message: "El empleado ya tiene una baja vigente" };
    }
    return { ok: false, message: "Error al registrar la baja" };
  }
}
