"use server";

import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import db from "@/database/connection";
import { IAuthUser } from "@/interfaces/auth";
import { buildDate } from "@/utils/date_helpper";
import {
  checkBlocked,
  recordFailedAttempt,
  resetAttempts,
  IP_THRESHOLD,
  IP_BLOCK_MINUTES,
  IP_WINDOW_MINUTES,
  EMAIL_THRESHOLD,
  EMAIL_BLOCK_MINUTES,
  EMAIL_WINDOW_MINUTES,
  REG_IP_THRESHOLD,
  REG_IP_BLOCK_MINUTES,
  REG_IP_WINDOW_MINUTES,
} from "@/lib/rateLimiter";

const JWT_SECRET     = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

async function getIP(): Promise<string> {
  const h         = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export type ActionResult<T = undefined> =
  | { ok: true;  data: T }
  | { ok: false; message: string; retryAfter?: string };

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
export async function loginAction(
  email: string,
  password: string
): Promise<ActionResult<IAuthUser>> {
  try {
    const ip      = await getIP();
    const ipCheck = await checkBlocked("IP", ip);
    if (ipCheck.blocked) {
      return {
        ok: false,
        message: "Demasiados intentos fallidos. Intente más tarde.",
        retryAfter: ipCheck.retryAfter,
      };
    }

    if (!email || !password) {
      return { ok: false, message: "Email y contraseña son requeridos" };
    }

    const emailCheck = await checkBlocked("EMAIL", email);
    if (emailCheck.blocked) {
      return {
        ok: false,
        message:
          "Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intente más tarde.",
        retryAfter: emailCheck.retryAfter,
      };
    }

    const rows = await db.queryParams(
      `SELECT u.[id_user],u.[nombre],u.[email],u.[telefono],u.[password_hash],
              u.[id_role],r.[nombre] AS role_nombre,u.[status],u.[id_sucursal],u.[id_empresa],
              ISNULL(u.[sucursales_string], '') AS sucursales_string
         FROM [CentroPodologico].[dbo].[users] u
         LEFT JOIN [CentroPodologico].[dbo].[roles] r ON r.[id_role] = u.[id_role]
        WHERE u.[email] = @email AND u.[deleted_at] IS NULL`,
      { email }
    );

    if (!rows || rows.length === 0) {
      await Promise.all([
        recordFailedAttempt("IP",    ip,    IP_THRESHOLD,    IP_BLOCK_MINUTES,    IP_WINDOW_MINUTES),
        recordFailedAttempt("EMAIL", email, EMAIL_THRESHOLD, EMAIL_BLOCK_MINUTES, EMAIL_WINDOW_MINUTES),
      ]);
      return { ok: false, message: "Credenciales inválidas" };
    }

    const userRow = rows[0] as {
      id_user:           number;
      nombre:            string;
      email:             string;
      password_hash:     string;
      id_role:           number;
      role_nombre:       string;
      status:            boolean;
      id_sucursal:       number;
      id_empresa:        number;
      sucursales_string: string;
    };

    const passwordMatch = await bcrypt.compare(password, userRow.password_hash);
    if (!passwordMatch) {
      await Promise.all([
        recordFailedAttempt("IP",    ip,    IP_THRESHOLD,    IP_BLOCK_MINUTES,    IP_WINDOW_MINUTES),
        recordFailedAttempt("EMAIL", email, EMAIL_THRESHOLD, EMAIL_BLOCK_MINUTES, EMAIL_WINDOW_MINUTES),
      ]);
      return { ok: false, message: "Credenciales inválidas" };
    }

    await Promise.all([
      resetAttempts("IP",    ip),
      resetAttempts("EMAIL", email),
    ]);

    const payload: IAuthUser = {
      id_user:           userRow.id_user,
      nombre:            userRow.nombre,
      email:             userRow.email,
      id_role:           userRow.id_role,
      role_nombre:       userRow.role_nombre ?? "",
      status:            userRow.status,
      id_sucursal:       userRow.id_sucursal,
      id_empresa:        userRow.id_empresa,
      sucursales_string: userRow.sucursales_string ?? "",
    };

    const token = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(JWT_SECRET);

    const cookieStore = await cookies();
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   COOKIE_MAX_AGE,
      path:     "/",
    });

    return { ok: true, data: payload };
  } catch (error) {
    console.error("[loginAction]", error);
    return { ok: false, message: "Error interno del servidor" };
  }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("auth_token", "", {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge:   0,
    path:     "/",
  });
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------
export async function registerAction(
  nombre:   string,
  email:    string,
  password: string,
  telefono: string
): Promise<ActionResult<IAuthUser>> {
  try {
    const ip      = await getIP();
    const ipCheck = await checkBlocked("REG_IP", ip);
    if (ipCheck.blocked) {
      return {
        ok: false,
        message: "Demasiadas solicitudes de registro. Intente más tarde.",
        retryAfter: ipCheck.retryAfter,
      };
    }

    if (!nombre || !email || !password || !telefono) {
      return { ok: false, message: "Todos los campos son requeridos" };
    }

    const existing = await db.queryParams(
      `SELECT [id_user] FROM [CentroPodologico].[dbo].[users]
        WHERE [email] = @email AND [deleted_at] IS NULL`,
      { email }
    );

    if (existing && existing.length > 0) {
      await recordFailedAttempt(
        "REG_IP", ip, REG_IP_THRESHOLD, REG_IP_BLOCK_MINUTES, REG_IP_WINDOW_MINUTES
      );
      return { ok: false, message: "El correo electrónico ya está registrado" };
    }

    const password_hash = await bcrypt.hash(password, 10);
    const now           = buildDate(new Date());

    const rows = await db.queryParams(
      `INSERT INTO [CentroPodologico].[dbo].[users]
         ([id_user],[nombre],[email],[telefono],[password_hash],[id_role],
          [status],[created_at],[updated_at],[deleted_at],[id_sucursal],[id_empresa])
       OUTPUT INSERTED.*
       VALUES (
         (SELECT ISNULL(MAX([id_user]),0)+1 FROM [CentroPodologico].[dbo].[users]),
         @nombre,@email,@telefono,@password_hash,@id_role,
         @status,@created_at,@updated_at,@deleted_at,@id_sucursal,@id_empresa
       )`,
      {
        nombre,
        email,
        telefono,
        password_hash,
        id_role:     3,
        status:      0,
        created_at:  now,
        updated_at:  now,
        deleted_at:  null,
        id_sucursal: 1,
        id_empresa:  1,
      }
    );

    const newUser = rows?.[0] as {
      id_user:     number;
      nombre:      string;
      email:       string;
      id_role:     number;
      status:      boolean;
      id_sucursal: number;
      id_empresa:  number;
    };

    const roleRows    = await db.queryParams(
      `SELECT [nombre] FROM [CentroPodologico].[dbo].[roles] WHERE [id_role] = @id_role`,
      { id_role: newUser.id_role }
    );
    const role_nombre = (roleRows?.[0]?.nombre as string) ?? "";

    const payload: IAuthUser = {
      id_user:           newUser.id_user,
      nombre:            newUser.nombre,
      email:             newUser.email,
      id_role:           newUser.id_role,
      role_nombre,
      status:            newUser.status,
      id_sucursal:       newUser.id_sucursal,
      id_empresa:        newUser.id_empresa,
      sucursales_string: String(newUser.id_sucursal ?? ""),
    };

    const token = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(JWT_SECRET);

    const cookieStore = await cookies();
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   COOKIE_MAX_AGE,
      path:     "/",
    });

    return { ok: true, data: payload };
  } catch (error) {
    console.error("[registerAction]", error);
    return { ok: false, message: "Error interno del servidor" };
  }
}

// ---------------------------------------------------------------------------
// Refresh / restore session
// ---------------------------------------------------------------------------
export async function getMeAction(): Promise<IAuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token       = cookieStore.get("auth_token")?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as IAuthUser;
  } catch {
    return null;
  }
}
