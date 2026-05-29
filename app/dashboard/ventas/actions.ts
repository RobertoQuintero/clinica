"use server";

import db from "@/database/connection";
import { IVenta } from "@/interfaces/venta";
import { IMetodoPago } from "@/interfaces/metodo_pago";
import { IAuthUser } from "@/interfaces/auth";
import { buildDate } from "@/utils/date_helpper";
import { createWebId } from "@/utils/random";
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

export async function getVentas(
  id_sucursal: number,
  fechaInicio: string,
  fechaFin: string
): Promise<IVenta[]> {
  const { id_empresa } = await getActiveUser();
  const data = await db.queryParams(
    `SELECT v.[id_venta],
            v.[id_producto],
            v.[cantidad],
            v.[idMetodoPago],
            v.[total],
            CONVERT(varchar(19), v.[created_at], 120) AS created_at,
            v.[id_usuario],
            v.[status],
            v.[webid],
            v.[facturado],
            v.[uuid_cfdi],
            p.[nombre] AS nombre_producto,
            mp.[descripcion] AS descripcion_metodo
       FROM [CentroPodologico].[dbo].[Ventas] v
 INNER JOIN [CentroPodologico].[dbo].[productos] p
         ON p.[id_producto] = v.[id_producto]
        AND p.[id_sucursal] = @id_sucursal
        AND p.[id_empresa]  = @id_empresa
  LEFT JOIN [CentroPodologico].[dbo].[MetodosPagos] mp
         ON mp.[idMetodoPago] = v.[idMetodoPago]
      WHERE v.[status] = 1
        AND CAST(v.[created_at] AS DATE) >= CAST(@fechaInicio AS DATE)
        AND CAST(v.[created_at] AS DATE) <= CAST(@fechaFin AS DATE)
      ORDER BY v.[created_at] DESC`,
    { id_sucursal, id_empresa, fechaInicio, fechaFin }
  );
  return data as IVenta[];
}

export async function getMetodosPagos(): Promise<IMetodoPago[]> {
  const data = await db.query(
    `SELECT [idMetodoPago], [descripcion], [clave], [eliminado], [activo]
       FROM [CentroPodologico].[dbo].[MetodosPagos]
      WHERE [activo] = 1 AND [eliminado] = 0`
  );
  return data as IMetodoPago[];
}

export type VentaForm = {
  id_venta:    number;
  id_producto: number;
  cantidad:    number;
  idMetodoPago: number;
  total:       number;
};

export async function saveVenta(
  form: VentaForm
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { id_venta, id_producto, cantidad, idMetodoPago, total } = form;
    const { id_user } = await getActiveUser();

    if (id_venta === 0) {
      await db.queryParams(
        `
        declare @id_venta int=(SELECT ISNULL(MAX([id_venta]), 0) + 1 FROM [CentroPodologico].[dbo].[Ventas])
        INSERT INTO [CentroPodologico].[dbo].[Ventas]
           ([id_venta], [id_producto], [cantidad], [idMetodoPago], [total],
            [created_at], [id_usuario], [status], [webid], [facturado], [uuid_cfdi])
         VALUES (
           @id_venta,
           @id_producto, @cantidad, @idMetodoPago, @total,
           @created_at, @id_usuario, 1, CONVERT(varchar,@id_venta)+'-'+@webid, 0, NULL
         )`,
        {
          id_producto,
          cantidad,
          idMetodoPago,
          total,
          created_at: buildDate(new Date()),
          id_usuario: id_user,
          webid: createWebId(8),
        }
      );
    } else {
      await db.queryParams(
        `UPDATE [CentroPodologico].[dbo].[Ventas]
            SET [id_producto]  = @id_producto,
                [cantidad]     = @cantidad,
                [idMetodoPago] = @idMetodoPago,
                [total]        = @total
          WHERE [id_venta] = @id_venta`,
        { id_venta, id_producto, cantidad, idMetodoPago, total }
      );
    }

    revalidatePath("/dashboard/ventas");
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al guardar la venta" };
  }
}

export async function deleteVenta(
  id_venta: number
): Promise<{ ok: boolean; message?: string }> {
  try {
    await db.queryParams(
      `UPDATE [CentroPodologico].[dbo].[Ventas] SET [status] = 0 WHERE [id_venta] = @id_venta`,
      { id_venta }
    );
    revalidatePath("/dashboard/ventas");
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al eliminar la venta" };
  }
}
