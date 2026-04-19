"use server";

import db from "@/database/connection";
import { ICatState, ISucursal } from "@/interfaces/sucursal";
import { IAuthUser } from "@/interfaces/auth";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

async function getActiveUser(): Promise<IAuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) throw new Error("No autenticado");
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as IAuthUser;
}

export async function getStates(): Promise<ICatState[]> {
  const data = await db.queryParams(
    `SELECT [id_state], [string_key], [description], [state_key], [status]
       FROM [CentroPodologico].[dbo].[Cat_states]
      WHERE [status] = 1`,
    {}
  );
  return data as ICatState[];
}

export async function getSucursales(): Promise<ISucursal[]> {
  const { id_empresa } = await getActiveUser();
  const data = await db.queryParams(
    `SELECT s.[id_sucursal],
            s.[id_empresa],
            s.[nombre],
            s.[ciudad],
            s.[direccion],
            s.[telefono],
            s.[activo],
            CONVERT(varchar(19), s.[created_at], 120) AS created_at,
            s.[status],
            s.[id_state],
            cs.[description] AS estado
       FROM [CentroPodologico].[dbo].[sucursales] s
       LEFT JOIN [CentroPodologico].[dbo].[Cat_states] cs
         ON cs.[id_state] = s.[id_state]
      WHERE s.[status] = 1
        AND s.[id_empresa] = @id_empresa`,
    { id_empresa }
  );
  return data as ISucursal[];
}

export async function saveSucursal(
  form: Pick<ISucursal, "id_sucursal" | "nombre" | "ciudad" | "direccion" | "telefono" | "id_state">
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { id_sucursal, nombre, ciudad, direccion, telefono, id_state } = form;
    const { id_empresa } = await getActiveUser();

    if (id_sucursal === 0) {
      await db.queryParams(
        `INSERT INTO [CentroPodologico].[dbo].[sucursales]
           ([id_sucursal], [id_empresa], [nombre], [ciudad], [direccion], [telefono], [activo], [created_at], [status], [id_state])
         VALUES (
           (SELECT ISNULL(MAX([id_sucursal]), 0) + 1 FROM [CentroPodologico].[dbo].[sucursales]),
           @id_empresa, @nombre, @ciudad, @direccion, @telefono, 1, @created_at, 1, @id_state
         )`,
        {
          id_empresa,
          nombre,
          ciudad: ciudad ?? null,
          direccion: direccion ?? null,
          telefono: telefono ?? null,
          created_at: buildDate(new Date()),
          id_state: id_state ?? null,
        }
      );
    } else {
      await db.queryParams(
        `UPDATE [CentroPodologico].[dbo].[sucursales]
            SET [nombre]    = @nombre,
                [ciudad]    = @ciudad,
                [direccion] = @direccion,
                [telefono]  = @telefono,
                [id_state]  = @id_state
          WHERE [id_sucursal] = @id_sucursal`,
        { id_sucursal, nombre, ciudad: ciudad ?? null, direccion: direccion ?? null, telefono: telefono ?? null, id_state: id_state ?? null }
      );
    }

    revalidatePath("/dashboard/sucursales");
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al guardar la sucursal" };
  }
}

export async function deleteSucursal(
  id_sucursal: number
): Promise<{ ok: boolean; message?: string }> {
  try {
    await db.queryParams(
      `UPDATE [CentroPodologico].[dbo].[sucursales]
          SET [status] = 0
        WHERE [id_sucursal] = @id_sucursal`,
      { id_sucursal }
    );
    revalidatePath("/dashboard/sucursales");
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al eliminar la sucursal" };
  }
}
