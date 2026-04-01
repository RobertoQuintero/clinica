"use server";

import db from "@/database/connection";
import { IUser } from "@/interfaces/user";
import { IRole } from "@/interfaces/roles";
import { ISucursal } from "@/interfaces/sucursal";
import { IAuthUser } from "@/interfaces/auth";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

async function getActiveUser(): Promise<IAuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) throw new Error("No autenticado");
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as IAuthUser;
}

export async function getUsuarios(): Promise<IUser[]> {
  const { id_sucursal, id_empresa } = await getActiveUser();
  const data = await db.queryParams(
    `SELECT [id_user],
            [nombre],
            [email],
            [telefono],
            [password_hash],
            [id_role],
            [status],
            CONVERT(varchar(19), [created_at], 120) AS created_at,
            CONVERT(varchar(19), [updated_at], 120) AS updated_at,
            CONVERT(varchar(19), [deleted_at], 120) AS deleted_at,
            [id_sucursal],
            [id_empresa]
       FROM [CentroPodologico].[dbo].[users]
      WHERE [id_sucursal] = @id_sucursal
        AND [id_empresa]  = @id_empresa`,
    { id_sucursal, id_empresa }
  );
  return data as IUser[];
}

export async function getRoles(): Promise<IRole[]> {
  const data = await db.query(
    `SELECT [id_role],
            [nombre],
            CONVERT(varchar(19), [created_at], 120) AS created_at
       FROM [CentroPodologico].[dbo].[roles]`
  );
  return data as IRole[];
}

export async function getSucursalesActivas(): Promise<ISucursal[]> {
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
      WHERE [status]     = 1
        AND [activo]     = 1
        AND [id_empresa] = @id_empresa`,
    { id_empresa }
  );
  return data as ISucursal[];
}

type SaveUsuarioForm = Pick<
  IUser,
  "id_user" | "nombre" | "email" | "telefono" | "password_hash" |
  "id_role" | "status" | "id_sucursal" | "id_empresa"
>;

export async function saveUsuario(
  form: SaveUsuarioForm
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { id_user, nombre, email, telefono, password_hash: rawPassword, id_role, status, id_sucursal, id_empresa } = form;

    if (id_user === 0) {
      if (!rawPassword) return { ok: false, message: "La contraseña es requerida" };
      const password_hash = await bcrypt.hash(rawPassword, 10);

      await db.queryParams(
        `INSERT INTO [CentroPodologico].[dbo].[users]
           ([id_user], [nombre], [email], [telefono], [password_hash], [id_role],
            [status], [created_at], [updated_at], [deleted_at], [id_sucursal], [id_empresa])
         VALUES (
           (SELECT ISNULL(MAX([id_user]), 0) + 1 FROM [CentroPodologico].[dbo].[users]),
           @nombre, @email, @telefono, @password_hash, @id_role,
           @status, @created_at, NULL, NULL, @id_sucursal, @id_empresa
         )`,
        {
          nombre, email, telefono, password_hash,
          id_role, status: status ? 1 : 0,
          created_at: buildDate(new Date()),
          id_sucursal, id_empresa,
        }
      );
    } else {
      let passwordClause = "";
      const passwordParam: Record<string, string> = {};

      if (rawPassword) {
        const password_hash = await bcrypt.hash(rawPassword, 10);
        passwordClause = "[password_hash] = @password_hash,";
        passwordParam.password_hash = password_hash;
      }

      await db.queryParams(
        `UPDATE [CentroPodologico].[dbo].[users]
            SET [nombre]      = @nombre,
                [email]       = @email,
                [telefono]    = @telefono,
                ${passwordClause}
                [id_role]     = @id_role,
                [status]      = @status,
                [updated_at]  = @updated_at,
                [id_sucursal] = @id_sucursal,
                [id_empresa]  = @id_empresa
          WHERE [id_user] = @id_user`,
        {
          id_user, nombre, email, telefono,
          ...passwordParam,
          id_role, status: status ? 1 : 0,
          updated_at: buildDate(new Date()),
          id_sucursal, id_empresa,
        }
      );
    }

    revalidatePath("/dashboard/usuarios");
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al guardar el usuario" };
  }
}
