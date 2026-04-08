"use server";

import db from "@/database/connection";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { IAuthUser } from "@/interfaces/auth";
import bcrypt from "bcryptjs";
import { buildDate } from "@/utils/date_helpper";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

async function getActiveUser(): Promise<IAuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) throw new Error("No autenticado");
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as IAuthUser;
}

export async function cambiarPassword(
  passwordActual: string,
  passwordNuevo: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const { id_user } = await getActiveUser();

    const rows = await db.queryParams(
      `SELECT [password_hash]
         FROM [CentroPodologico].[dbo].[users]
        WHERE [id_user] = @id_user`,
      { id_user }
    ) as { password_hash: string }[];

    if (!rows.length) {
      return { ok: false, message: "Usuario no encontrado" };
    }

    const match = await bcrypt.compare(passwordActual, rows[0].password_hash);
    if (!match) {
      return { ok: false, message: "La contraseña actual es incorrecta" };
    }

    const newHash = await bcrypt.hash(passwordNuevo, 10);

    await db.queryParams(
      `UPDATE [CentroPodologico].[dbo].[users]
          SET [password_hash] = @password_hash,
              [updated_at]    = @updated_at
        WHERE [id_user] = @id_user`,
      { password_hash: newHash, updated_at: buildDate(new Date()), id_user }
    );

    return { ok: true, message: "Contraseña actualizada correctamente" };
  } catch {
    return { ok: false, message: "Error al actualizar la contraseña" };
  }
}
