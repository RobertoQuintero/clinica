import "server-only";

import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import type { IAuthUser } from "@/interfaces/auth";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

/** Roles que administran RH: mismos que `proxy.ts` permite en `/dashboard/empleados`. */
const VACATION_ALLOWED_ROLE_IDS = [1, 4];

export type VacationAccessResult =
  | { ok: true; data: { id_user: number } }
  | { ok: false; message: string };

/**
 * Gate de rol dentro del propio server action (además de `proxy.ts`): una server action
 * se puede invocar sin pasar por la ruta, así que las escrituras repiten la restricción.
 */
export async function assertVacationAccess(): Promise<VacationAccessResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return { ok: false, message: "No autenticado" };

  let user: IAuthUser;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    user = payload as unknown as IAuthUser;
  } catch {
    return { ok: false, message: "Sesión inválida" };
  }

  if (!VACATION_ALLOWED_ROLE_IDS.includes(user.id_role)) {
    return { ok: false, message: "No tienes permisos para administrar RH" };
  }
  return { ok: true, data: { id_user: user.id_user } };
}
