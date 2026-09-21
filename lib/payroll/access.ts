import "server-only";

import { IAuthUser } from "@/interfaces/auth";
import { PAYROLL_ALLOWED_ROLE_IDS } from "@/lib/payroll/constants";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export interface IPayrollSession {
  id_sucursal: number;
  id_user: number;
}

export const PERIOD_ROW_SELECT = `
  p.id_period, p.id_sucursal, p.id_payment_period, p.codigo, p.ejercicio, p.consecutivo,
  CONVERT(varchar(10), p.fecha_inicio, 120) AS fecha_inicio,
  CONVERT(varchar(10), p.fecha_fin, 120)    AS fecha_fin,
  CONVERT(varchar(10), p.fecha_corte, 120)  AS fecha_corte,
  CONVERT(varchar(10), p.fecha_pago, 120)   AS fecha_pago,
  p.status, p.created_by,
  CONVERT(varchar(19), p.created_at, 120)   AS created_at,
  CONVERT(varchar(19), p.updated_at, 120)   AS updated_at,
  pp.description AS frecuencia_descripcion,
  pp.clave_sat   AS frecuencia_clave_sat`;

/**
 * Gate de rol dentro del propio server action (además de `proxy.ts`) y sucursal activa
 * derivada del servidor (cookie `sel_sucursal` con respaldo en el JWT), nunca del cliente.
 */
export async function assertPayrollAccess(): Promise<ActionResult<IPayrollSession>> {
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

  if (!PAYROLL_ALLOWED_ROLE_IDS.includes(user.id_role)) {
    return { ok: false, message: "No tienes permisos para acceder a Nómina" };
  }

  const selectedBranchId = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
  const id_sucursal = selectedBranchId > 0 ? selectedBranchId : user.id_sucursal;
  return { ok: true, data: { id_sucursal, id_user: user.id_user } };
}
