import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import db from "@/database/connection";
import { IRegisterPayload, IAuthUser } from "@/interfaces/auth";
import {
  getClientIP,
  checkBlocked,
  recordFailedAttempt,
  REG_IP_THRESHOLD,
  REG_IP_BLOCK_MINUTES,
  REG_IP_WINDOW_MINUTES,
} from "@/lib/rateLimiter";

const JWT_SECRET     = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

export const POST = async (req: Request) => {
  try {
    const ip = getClientIP(req);

    // --- Protección contra abuso masivo de registro por IP ---
    const ipCheck = await checkBlocked("REG_IP", ip);
    if (ipCheck.blocked) {
      return NextResponse.json(
        {
          ok: false,
          message: "Demasiadas solicitudes de registro. Intente más tarde.",
          retryAfter: ipCheck.retryAfter,
        },
        { status: 429, headers: { "Retry-After": ipCheck.retryAfter! } }
      );
    }

    const body: IRegisterPayload = await req.json();
    const { nombre, email, password, telefono } = body;

    if (!nombre || !email || !password || !telefono) {
      return NextResponse.json(
        { ok: false, message: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    // Verificar si el email ya está registrado
    const existing = await db.queryParams(
      `SELECT [id_user] FROM [CentroPodologico].[dbo].[users]
        WHERE [email] = @email AND [deleted_at] IS NULL`,
      { email }
    );

    if (existing && existing.length > 0) {
      await recordFailedAttempt("REG_IP", ip, REG_IP_THRESHOLD, REG_IP_BLOCK_MINUTES, REG_IP_WINDOW_MINUTES);
      return NextResponse.json(
        { ok: false, message: "El correo electrónico ya está registrado" },
        { status: 409 }
      );
    }

    // Hashear el password
    const password_hash = await bcrypt.hash(password, 10);

    const now = new Date().toISOString();

    // Insertar usuario con valores por defecto
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
        id_role:     1,
        status:      1,
        created_at:  now,
        updated_at:  now,
        deleted_at:  null,
        id_sucursal: 1,
        id_empresa:  1,
      }
    );

    const newUser = rows?.[0] as {
      id_user:    number;
      nombre:     string;
      email:      string;
      id_role:    number;
      status:     boolean;
      id_sucursal: number;
      id_empresa:  number;
    };

    // Payload del JWT (sin password_hash)
    const payload: IAuthUser = {
      id_user:     newUser.id_user,
      nombre:      newUser.nombre,
      email:       newUser.email,
      id_role:     newUser.id_role,
      status:      newUser.status,
      id_sucursal: newUser.id_sucursal,
      id_empresa:  newUser.id_empresa,
    };

    // Firmar JWT y auto-login
    const token = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(JWT_SECRET);

    const response = NextResponse.json({ ok: true, user: payload }, { status: 201 });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   COOKIE_MAX_AGE,
      path:     "/",
    });

    return response;
  } catch (error) {
    console.error("[auth/register]", error);
    return NextResponse.json(
      { ok: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
};
