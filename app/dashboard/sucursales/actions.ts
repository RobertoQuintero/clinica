"use server";

import db from "@/database/connection";
import { ISucursal } from "@/interfaces/sucursal";
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

export async function getSucursales(): Promise<ISucursal[]> {
  const { id_empresa } = await getActiveUser();
  const data = await db.queryParams(
    `SELECT [id_sucursal],
            [id_empresa],
            [nombre],
            [ciudad],
            [direccion],
            [telefono],
            [activo],
            CONVERT(varchar(19), [created_at], 120) AS created_at,
            [status]
       FROM [CentroPodologico].[dbo].[sucursales]
      WHERE [status] = 1
        AND [id_empresa] = @id_empresa`,
    { id_empresa }
  );
  return data as ISucursal[];
}

export async function saveSucursal(
  form: Pick<ISucursal, "id_sucursal" | "nombre" | "ciudad" | "direccion" | "telefono">
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { id_sucursal, nombre, ciudad, direccion, telefono } = form;
    const { id_empresa } = await getActiveUser();

    if (id_sucursal === 0) {
      await db.queryParams(
        `INSERT INTO [CentroPodologico].[dbo].[sucursales]
           ([id_sucursal], [id_empresa], [nombre], [ciudad], [direccion], [telefono], [activo], [created_at], [status])
         VALUES (
           (SELECT ISNULL(MAX([id_sucursal]), 0) + 1 FROM [CentroPodologico].[dbo].[sucursales]),
           @id_empresa, @nombre, @ciudad, @direccion, @telefono, 1, @created_at, 1
         )`,
        {
          id_empresa,
          nombre,
          ciudad: ciudad ?? null,
          direccion: direccion ?? null,
          telefono: telefono ?? null,
          created_at: buildDate(new Date()),
        }
      );
    } else {
      await db.queryParams(
        `UPDATE [CentroPodologico].[dbo].[sucursales]
            SET [nombre]    = @nombre,
                [ciudad]    = @ciudad,
                [direccion] = @direccion,
                [telefono]  = @telefono
          WHERE [id_sucursal] = @id_sucursal`,
        { id_sucursal, nombre, ciudad: ciudad ?? null, direccion: direccion ?? null, telefono: telefono ?? null }
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
