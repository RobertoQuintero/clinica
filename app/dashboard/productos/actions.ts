"use server";

import db from "@/database/connection";
import { IProducto } from "@/interfaces/producto";
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

export async function getProductos(id_sucursal: number): Promise<IProducto[]> {
  const { id_empresa } = await getActiveUser();
  const data = await db.queryParams(
    `SELECT [id_producto],
            [nombre],
            [precio],
            [descripcion],
            [status],
            CONVERT(varchar(19), [created_at], 120) AS created_at,
            [id_empresa],
            [id_sucursal]
       FROM [CentroPodologico].[dbo].[productos]
      WHERE [status] = 1
        AND [id_empresa] = @id_empresa
        AND [id_sucursal] = @id_sucursal`,
    { id_empresa, id_sucursal }
  );
  return data as IProducto[];
}

export async function saveProducto(
  form: Pick<IProducto, "id_producto" | "nombre" | "precio" | "descripcion" | "id_sucursal">
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { id_producto, nombre, precio, descripcion, id_sucursal } = form;
    const { id_empresa } = await getActiveUser();

    if (id_producto === 0) {
      await db.queryParams(
        `INSERT INTO [CentroPodologico].[dbo].[productos]
           ([id_producto], [nombre], [precio], [descripcion], [status], [created_at], [id_empresa], [id_sucursal])
         VALUES (
           (SELECT ISNULL(MAX([id_producto]), 0) + 1 FROM [CentroPodologico].[dbo].[productos]),
           @nombre, @precio, @descripcion, 1, @created_at, @id_empresa, @id_sucursal
         )`,
        { nombre, precio, descripcion, created_at: buildDate(new Date()), id_empresa, id_sucursal }
      );
    } else {
      await db.queryParams(
        `UPDATE [CentroPodologico].[dbo].[productos]
            SET [nombre] = @nombre,
                [precio] = @precio,
                [descripcion] = @descripcion
          WHERE [id_producto] = @id_producto`,
        { id_producto, nombre, precio, descripcion }
      );
    }

    revalidatePath("/dashboard/productos");
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al guardar el producto" };
  }
}

export async function deleteProducto(
  id_producto: number
): Promise<{ ok: boolean; message?: string }> {
  try {
    await db.queryParams(
      `UPDATE [CentroPodologico].[dbo].[productos]
          SET [status] = 0
        WHERE [id_producto] = @id_producto`,
      { id_producto }
    );
    revalidatePath("/dashboard/productos");
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al eliminar el producto" };
  }
}
