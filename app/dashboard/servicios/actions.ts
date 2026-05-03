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

export async function copiarServicios(
  id_sucursal_destino: number
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { id_empresa } = await getActiveUser();

    // 1. First sucursal with status = true
    const sucursalData = await db.queryParams(
      `SELECT TOP 1 [id_sucursal]
         FROM [CentroPodologico].[dbo].[sucursales]
        WHERE [status] = 1
        ORDER BY [id_sucursal]`,
      {}
    ) as { id_sucursal: number }[];

    if (!sucursalData || sucursalData.length === 0) {
      return { ok: false, message: "No se encontró una sucursal origen activa" };
    }

    const id_sucursal_origen = sucursalData[0].id_sucursal;

    // 2. Services with status = true from origin
    const serviciosOrigen = await db.queryParams(
      `SELECT [id_servicio], [nombre], [descripcion]
         FROM [CentroPodologico].[dbo].[servicios]
        WHERE [status] = 1
          AND [id_sucursal] = @id_sucursal_origen
          AND [id_empresa]  = @id_empresa`,
      { id_sucursal_origen, id_empresa }
    ) as { id_servicio: number; nombre: string; descripcion: string }[];

    if (serviciosOrigen.length === 0) {
      return { ok: false, message: "No hay servicios activos en la sucursal origen" };
    }

    // 3. Fetch all options for those services (status = true)
    const opcionesOrigen = await db.queryParams(
      `SELECT [id_servicio], [nombre], [descripcion], [precio]
         FROM [CentroPodologico].[dbo].[servicio_opciones]
        WHERE [status] = 1
          AND [id_servicio] IN (SELECT [id_servicio]
                                  FROM [CentroPodologico].[dbo].[servicios]
                                 WHERE [status] = 1
                                   AND [id_sucursal] = @id_sucursal_origen
                                   AND [id_empresa]  = @id_empresa)`,
      { id_sucursal_origen, id_empresa }
    ) as { id_servicio: number; nombre: string; descripcion: string; precio: number }[];

    // 4. Reserve ID ranges (no auto-increment in this schema)
    const maxSvcData = await db.queryParams(
      `SELECT ISNULL(MAX([id_servicio]), 0) AS max_id FROM [CentroPodologico].[dbo].[servicios]`,
      {}
    ) as { max_id: number }[];
    let nextServiceId = maxSvcData[0].max_id + 1;

    const maxOptData = await db.queryParams(
      `SELECT ISNULL(MAX([id_servicio_opcion]), 0) AS max_id FROM [CentroPodologico].[dbo].[servicio_opciones]`,
      {}
    ) as { max_id: number }[];
    let nextOptionId = maxOptData[0].max_id + 1;

    const now = buildDate(new Date());

    // 5. Insert services and their options
    for (const servicio of serviciosOrigen) {
      const new_id_servicio = nextServiceId++;

      await db.queryParams(
        `INSERT INTO [CentroPodologico].[dbo].[servicios]
           ([id_servicio],[nombre],[descripcion],[status],[cretated_at],[id_empresa],[id_sucursal])
         VALUES (@id_servicio, @nombre, @descripcion, 1, @cretated_at, @id_empresa, @id_sucursal)`,
        {
          id_servicio: new_id_servicio,
          nombre: servicio.nombre,
          descripcion: servicio.descripcion,
          cretated_at: now,
          id_empresa,
          id_sucursal: id_sucursal_destino,
        }
      );

      const opcionesDeServicio = opcionesOrigen.filter(
        (o) => o.id_servicio === servicio.id_servicio
      );

      for (const opcion of opcionesDeServicio) {
        await db.queryParams(
          `INSERT INTO [CentroPodologico].[dbo].[servicio_opciones]
             ([id_servicio_opcion],[id_servicio],[nombre],[descripcion],[precio],[id_sucursal],[status])
           VALUES (@id_servicio_opcion, @id_servicio, @nombre, @descripcion, @precio, @id_sucursal, 1)`,
          {
            id_servicio_opcion: nextOptionId++,
            id_servicio: new_id_servicio,
            nombre: opcion.nombre,
            descripcion: opcion.descripcion,
            precio: opcion.precio,
            id_sucursal: id_sucursal_destino,
          }
        );
      }
    }

    revalidatePath("/dashboard/servicios");
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al copiar servicios" };
  }
}
