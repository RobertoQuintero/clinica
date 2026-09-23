"use server";

import db from "@/database/connection";
import { IEmployeeUserListItem } from "@/interfaces/user";
import { getEmployeeById } from "@/app/dashboard/empleados/actions";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import {
  linkUserToEmployeeSchema,
  unlinkUserFromEmployeeSchema,
} from "./schemas";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

const EMPLOYEE_USER_SELECT = `
  SELECT u.[id_user],
         u.[nombre],
         u.[email],
         u.[id_role],
         r.[nombre] AS nombre_role,
         u.[id_sucursal],
         s.[nombre] AS nombre_sucursal,
         u.[status]
    FROM [CentroPodologico].[dbo].[users] u
    JOIN [CentroPodologico].[dbo].[roles] r ON r.[id_role] = u.[id_role]
    JOIN [CentroPodologico].[dbo].[sucursales] s ON s.[id_sucursal] = u.[id_sucursal]`;

/** Usuarios vinculados al empleado, sin filtrar por status (un vínculo previo no se oculta). */
export async function getEmployeeLinkedUsers(
  id_empleado: number
): Promise<IEmployeeUserListItem[]> {
  const employee = await getEmployeeById(id_empleado);
  if (!employee) return [];

  const data = await db.queryParams(
    `${EMPLOYEE_USER_SELECT}
      WHERE u.[id_empleado] = @id_empleado
      ORDER BY u.[nombre]`,
    { id_empleado }
  );
  return data as IEmployeeUserListItem[];
}

/** Usuarios elegibles para vincular: misma empresa que el empleado, status = 1 y sin vínculo. */
export async function getLinkableUsers(
  id_empleado: number
): Promise<IEmployeeUserListItem[]> {
  const employee = await getEmployeeById(id_empleado);
  if (!employee) return [];

  const data = await db.queryParams(
    `${EMPLOYEE_USER_SELECT}
      WHERE u.[id_empleado] IS NULL
        AND u.[status]      = 1
        AND u.[id_empresa]  = @id_empresa
      ORDER BY u.[nombre]`,
    { id_empresa: employee.id_empresa }
  );
  return data as IEmployeeUserListItem[];
}

function revalidateEmployeeUserViews(id_empleado: number) {
  revalidatePath(`/dashboard/empleados/${id_empleado}/usuarios`);
  revalidatePath("/dashboard/usuarios");
}

export async function linkUserToEmployee(input: unknown): Promise<ActionResult<null>> {
  try {
    const parsed = linkUserToEmployeeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: "Datos inválidos" };
    const { id_empleado, id_user } = parsed.data;

    const employee = await getEmployeeById(id_empleado);
    if (!employee) return { ok: false, message: "El empleado no existe o no tienes acceso a él" };

    const userRows = (await db.queryParams(
      `SELECT [id_empresa], [status], [id_empleado]
         FROM [CentroPodologico].[dbo].[users]
        WHERE [id_user] = @id_user`,
      { id_user }
    )) as { id_empresa: number; status: boolean; id_empleado: number | null }[];
    if (userRows.length === 0) return { ok: false, message: "El usuario no existe" };

    const targetUser = userRows[0];
    if (targetUser.id_empresa !== employee.id_empresa) {
      return { ok: false, message: "El usuario pertenece a otra empresa" };
    }
    if (!targetUser.status) return { ok: false, message: "El usuario no está activo" };
    if (targetUser.id_empleado !== null) {
      return { ok: false, message: "El usuario ya está vinculado a un empleado" };
    }

    // La condición IS NULL se repite en el WHERE: si otro admin vinculó al mismo tiempo,
    // no se afecta ninguna fila y no se pisa su vínculo.
    const updatedRows = await db.queryParams(
      `UPDATE [CentroPodologico].[dbo].[users]
          SET [id_empleado] = @id_empleado,
              [updated_at]  = @updated_at
       OUTPUT INSERTED.[id_user]
        WHERE [id_user] = @id_user
          AND [id_empleado] IS NULL`,
      { id_empleado, id_user, updated_at: buildDate(new Date()) }
    );
    if (updatedRows.length === 0) {
      return { ok: false, message: "El usuario ya está vinculado a un empleado" };
    }

    revalidateEmployeeUserViews(id_empleado);
    return { ok: true, data: null };
  } catch {
    return { ok: false, message: "Error al vincular el usuario" };
  }
}

export async function unlinkUserFromEmployee(input: unknown): Promise<ActionResult<null>> {
  try {
    const parsed = unlinkUserFromEmployeeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: "Datos inválidos" };
    const { id_empleado, id_user } = parsed.data;

    const employee = await getEmployeeById(id_empleado);
    if (!employee) return { ok: false, message: "El empleado no existe o no tienes acceso a él" };

    // La condición id_empleado = @id_empleado se repite en el WHERE: una segunda llamada
    // (otra pestaña abierta) no afecta filas y devuelve { ok: false }.
    const updatedRows = await db.queryParams(
      `UPDATE [CentroPodologico].[dbo].[users]
          SET [id_empleado] = NULL,
              [updated_at]  = @updated_at
       OUTPUT INSERTED.[id_user]
        WHERE [id_user] = @id_user
          AND [id_empleado] = @id_empleado`,
      { id_empleado, id_user, updated_at: buildDate(new Date()) }
    );
    if (updatedRows.length === 0) {
      return { ok: false, message: "El usuario ya no está vinculado a este empleado" };
    }

    revalidateEmployeeUserViews(id_empleado);
    return { ok: true, data: null };
  } catch {
    return { ok: false, message: "Error al desvincular el usuario" };
  }
}
