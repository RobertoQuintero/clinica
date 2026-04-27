"use server";

import db from "@/database/connection";
import { IServicio } from "@/interfaces/servicio";
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

export async function getServicios(id_sucursal: number): Promise<IServicio[]> {
  const { id_empresa } = await getActiveUser();
  const data = await db.queryParams(
    `SELECT [id_servicio],
            [nombre],
            [descripcion],
            [status],
            CONVERT(varchar(19), [cretated_at], 120) AS cretated_at,
            [id_empresa],
            [id_sucursal]
       FROM [CentroPodologico].[dbo].[servicios]
      WHERE [status] = 1
        AND [id_empresa] = @id_empresa
        AND [id_sucursal] = @id_sucursal`,
    { id_empresa, id_sucursal }
  );
  return data as IServicio[];
}

export async function saveServicio(
  form: Pick<IServicio, "id_servicio" | "nombre" | "descripcion" | "id_sucursal">
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { id_servicio, nombre, descripcion, id_sucursal } = form;
    const { id_empresa } = await getActiveUser();

    if (id_servicio === 0) {
      await db.queryParams(
        `INSERT INTO [CentroPodologico].[dbo].[servicios]
           ([id_servicio], [nombre], [descripcion], [status], [cretated_at], [id_empresa], [id_sucursal])
         VALUES (
           (SELECT ISNULL(MAX([id_servicio]), 0) + 1 FROM [CentroPodologico].[dbo].[servicios]),
           @nombre, @descripcion, 1, @cretated_at, @id_empresa, @id_sucursal
         )`,
        { nombre, descripcion, cretated_at: buildDate(new Date()), id_empresa, id_sucursal }
      );
    } else {
      await db.queryParams(
        `UPDATE [CentroPodologico].[dbo].[servicios]
            SET [nombre] = @nombre,
                [descripcion] = @descripcion
          WHERE [id_servicio] = @id_servicio`,
        { id_servicio, nombre, descripcion }
      );
    }

    revalidatePath("/dashboard/servicios");
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al guardar el servicio" };
  }
}

export async function deleteServicio(
  id_servicio: number
): Promise<{ ok: boolean; message?: string }> {
  try {
    await db.queryParams(
      `UPDATE [CentroPodologico].[dbo].[servicios]
          SET [status] = 0
        WHERE [id_servicio] = @id_servicio`,
      { id_servicio }
    );
    revalidatePath("/dashboard/servicios");
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al eliminar el servicio" };
  }
}
