import "server-only";

import db from "@/database/connection";
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
  id_empresa: number;
}

export const PERIOD_ROW_SELECT = `
  p.id_period, p.id_sucursal, p.id_payment_period, p.codigo, p.ejercicio, p.consecutivo,
  CONVERT(varchar(10), p.fecha_inicio, 120) AS fecha_inicio,
  CONVERT(varchar(10), p.fecha_fin, 120)    AS fecha_fin,
  CONVERT(varchar(10), p.fecha_corte, 120)  AS fecha_corte,
  CONVERT(varchar(10), p.fecha_pago, 120)   AS fecha_pago,
  p.status, p.tipo_periodo, p.concepto_extraordinario, p.created_by,
  CONVERT(varchar(19), p.created_at, 120)   AS created_at,
  CONVERT(varchar(19), p.updated_at, 120)   AS updated_at,
  p.approved_by,
  CONVERT(varchar(19), p.approved_at, 120)  AS approved_at,
  p.paid_by,
  CONVERT(varchar(19), p.paid_at, 120)      AS paid_at,
  pp.description AS frecuencia_descripcion,
  pp.clave_sat   AS frecuencia_clave_sat`;

/**
 * Valida la identidad del JWT y consulta la autorización vigente del usuario.
 */
export async function getCurrentPayrollUser(): Promise<ActionResult<IPayrollSession>> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return { ok: false, message: "No autenticado" };

  let idUser: number;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (typeof payload.id_user !== "number" || !Number.isSafeInteger(payload.id_user) || payload.id_user <= 0) {
      return { ok: false, message: "Sesión inválida" };
    }
    idUser = payload.id_user;
  } catch {
    return { ok: false, message: "Sesión inválida" };
  }

  try {
    const rows = await db.queryParams(
      `SELECT id_user, id_role, id_empresa, id_sucursal
         FROM dbo.users
        WHERE id_user = @id_user AND status = 1 AND deleted_at IS NULL`,
      { id_user: idUser },
    );
    const user = rows[0] as (IPayrollSession & { id_role: number }) | undefined;
    if (user && PAYROLL_ALLOWED_ROLE_IDS.includes(user.id_role)) {
      return { ok: true, data: { id_user: user.id_user, id_empresa: user.id_empresa, id_sucursal: user.id_sucursal } };
    }
  } catch {
    return { ok: false, message: "No fue posible validar el acceso a Nómina" };
  }
  return { ok: false, message: "No tienes permisos para acceder a Nómina" };
}

export async function assertPayrollAccess(): Promise<ActionResult<IPayrollSession>> {
  const result = await getCurrentPayrollUser();
  if (!result.ok) {
    return result;
  }
  const user = result.data;
  const cookieStore = await cookies();
  const selectedBranch = cookieStore.get("sel_sucursal")?.value;
  const selectedBranchId = selectedBranch && /^\d+$/.test(selectedBranch) ? Number(selectedBranch) : 0;
  const candidates = [selectedBranchId, user.id_sucursal].filter(
    (id, index, ids) => Number.isSafeInteger(id) && id > 0 && ids.indexOf(id) === index,
  );

  try {
    for (const idSucursal of candidates) {
      const rows = await db.queryParams(
        `SELECT id_sucursal FROM dbo.sucursales
          WHERE id_sucursal = @id_sucursal AND id_empresa = @id_empresa AND status = 1`,
        { id_sucursal: idSucursal, id_empresa: user.id_empresa },
      );
      if (rows.length > 0) {
        return { ok: true, data: { ...user, id_sucursal: idSucursal } };
      }
    }
  } catch {
    return { ok: false, message: "No fue posible validar el acceso a Nómina" };
  }
  return { ok: false, message: "No tienes una sucursal válida para acceder a Nómina" };
}
