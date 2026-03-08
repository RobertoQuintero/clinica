import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import db from "@/database/connection";
import { ILoginPayload, IAuthUser } from "@/interfaces/auth";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

export const POST = async (req: Request) => {
  try {
    const body: ILoginPayload = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, message: "Email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    // Buscar usuario por email
    const rows = await db.queryParams(
      `SELECT [id_user],[nombre],[email],[telefono],[password_hash],
              [id_role],[status],[id_sucursal],[id_empresa]
         FROM [CentroPodologico].[dbo].[users]
        WHERE [email] = @email AND [deleted_at] IS NULL`,
      { email }
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const userRow = rows[0] as {
      id_user: number;
      nombre: string;
      email: string;
      password_hash: string;
      id_role: number;
      status: boolean;
      id_sucursal: number;
      id_empresa: number;
    };

    // Verificar que la cuenta esté activa
    if (!userRow.status) {
      return NextResponse.json(
        { ok: false, message: "Cuenta inactiva" },
        { status: 403 }
      );
    }

    // Comparar password con bcryptjs
    const passwordMatch = await bcrypt.compare(password, userRow.password_hash);
    if (!passwordMatch) {
      return NextResponse.json(
        { ok: false, message: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // Payload del JWT
    const payload: IAuthUser = {
      id_user:     userRow.id_user,
      nombre:      userRow.nombre,
      email:       userRow.email,
      id_role:     userRow.id_role,
      status:      userRow.status,
      id_sucursal: userRow.id_sucursal,
      id_empresa:  userRow.id_empresa,
    };

    // Firmar JWT
    const token = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(JWT_SECRET);

    // Construir respuesta y setear cookie httpOnly
    const response = NextResponse.json({ ok: true, user: payload });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   COOKIE_MAX_AGE,
      path:     "/",
    });

    return response;
  } catch (error) {
    console.error("[auth/login]", error);
    return NextResponse.json(
      { ok: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
};
