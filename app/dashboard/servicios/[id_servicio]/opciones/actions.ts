"use server";

import db from "@/database/connection";
import { IServicioOpcion } from "@/interfaces/servicio_opcion";
import { IServicio } from "@/interfaces/servicio";
import { IAuthUser } from "@/interfaces/auth";
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

export async function getServicio(id_servicio: number): Promise<IServicio | null> {
  const data = await db.queryParams(
    `SELECT [id_servicio], [nombre]
       FROM [CentroPodologico].[dbo].[servicios]
      WHERE [id_servicio] = @id_servicio`,
    { id_servicio }
  );
  return (data as IServicio[])[0] ?? null;
}

export async function getOpcionesServicio(id_servicio: number): Promise<IServicioOpcion[]> {
  const data = await db.queryParams(
    `SELECT [id_servicio_opcion],
            [id_servicio],
            [nombre],
            [descripcion],
            [precio],
            [id_sucursal],
            [status]
       FROM [CentroPodologico].[dbo].[servicio_opciones]
      WHERE [id_servicio] = @id_servicio
        AND [status] = 1`,
    { id_servicio }
  );
  return data as IServicioOpcion[];
}

export async function saveOpcionServicio(
  form: Omit<IServicioOpcion, "id_sucursal" | "status">
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { id_servicio_opcion, id_servicio, nombre, descripcion, precio } = form;
    const { id_sucursal } = await getActiveUser();

    if (id_servicio_opcion === 0) {
      await db.queryParams(
        `INSERT INTO [CentroPodologico].[dbo].[servicio_opciones]
           ([id_servicio_opcion],[id_servicio],[nombre],[descripcion],[precio],[id_sucursal],[status])
         VALUES (
           (SELECT ISNULL(MAX([id_servicio_opcion]),0)+1 FROM [CentroPodologico].[dbo].[servicio_opciones]),
           @id_servicio,@nombre,@descripcion,@precio,@id_sucursal,1
         )`,
        { id_servicio, nombre, descripcion, precio: Number(precio), id_sucursal }
      );
    } else {
      await db.queryParams(
        `UPDATE [CentroPodologico].[dbo].[servicio_opciones] SET
            [nombre]      = @nombre,
            [descripcion] = @descripcion,
            [precio]      = @precio
          WHERE [id_servicio_opcion] = @id_servicio_opcion`,
        { id_servicio_opcion, nombre, descripcion, precio: Number(precio) }
      );
    }

    revalidatePath(`/dashboard/servicios/${id_servicio}/opciones`);
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al guardar la opción" };
  }
}

export async function deleteOpcionServicio(
  id_servicio_opcion: number,
  id_servicio: number
): Promise<{ ok: boolean; message?: string }> {
  try {
    await db.queryParams(
      `UPDATE [CentroPodologico].[dbo].[servicio_opciones]
          SET [status] = 0
        WHERE [id_servicio_opcion] = @id_servicio_opcion`,
      { id_servicio_opcion }
    );
    revalidatePath(`/dashboard/servicios/${id_servicio}/opciones`);
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al eliminar la opción" };
  }
}
