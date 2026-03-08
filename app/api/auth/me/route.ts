import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { IAuthUser } from "@/interfaces/auth";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

export const GET = async () => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "No autenticado" },
        { status: 401 }
      );
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const user = payload as unknown as IAuthUser;

    return NextResponse.json({ ok: true, user });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Token inválido o expirado" },
      { status: 401 }
    );
  }
};
