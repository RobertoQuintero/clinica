"use server";

import db from "@/database/connection";
import { ICita } from "@/interfaces/cita";
import { IPaciente } from "@/interfaces/paciente";
import { IUser } from "@/interfaces/user";
import { IAuthUser } from "@/interfaces/auth";
import { toDBString, buildDate } from "@/utils/date_helpper";
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

export async function getCitas(): Promise<ICita[]> {
  const cookieStore = await cookies();
  const { id_sucursal: jwtSucursal, id_empresa } = await getActiveUser();
  const selCookie = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
  const id_sucursal = selCookie > 0 ? selCookie : jwtSucursal;
  const data = await db.queryParams(
    `SELECT [id_cita]
           ,[id_paciente]
           ,[id_podologo]
           ,CONVERT(varchar(19), [fecha_inicio], 120) AS fecha_inicio
           ,CONVERT(varchar(19), [fecha_fin],    120) AS fecha_fin
           ,[estado]
           ,[motivo_cancelacion]
           ,CONVERT(varchar(19), [created_at],   120) AS created_at
           ,CONVERT(varchar(19), [deleted_at],   120) AS deleted_at
           ,[id_sucursal]
           ,[id_empresa]
       FROM [CentroPodologico].[dbo].[citas]
      WHERE [id_sucursal] = @id_sucursal
        AND [id_empresa]  = @id_empresa`,
    { id_sucursal, id_empresa }
  );
  return data as ICita[];
}

export async function getPacientes(): Promise<IPaciente[]> {
  const cookieStore = await cookies();
  const { id_sucursal: jwtSucursal, id_empresa } = await getActiveUser();
  const selCookie = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
  const id_sucursal = selCookie > 0 ? selCookie : jwtSucursal;
  const data = await db.queryParams(
    `SELECT [id_paciente]
           ,[nombre]
           ,[apellido_paterno]
           ,[apellido_materno]
           ,[telefono]
           ,CONVERT(varchar(10), [fecha_nacimiento], 120) AS fecha_nacimiento
           ,[direccion]
           ,[observaciones_generales]
           ,CONVERT(varchar(19), [created_at], 120) AS created_at
           ,CONVERT(varchar(19), [updated_at], 120) AS updated_at
           ,CONVERT(varchar(19), [deleted_at], 120) AS deleted_at
           ,[sexo]
           ,[whatsapp]
           ,[ciudad_preferida]
           ,[contacto_emergencia_nombre]
           ,[contacto_emergencia_whatsapp]
           ,[id_sucursal]
           ,[id_empresa]
       FROM [CentroPodologico].[dbo].[pacientes]
      WHERE [id_sucursal] = @id_sucursal
        AND [id_empresa]  = @id_empresa`,
    { id_sucursal, id_empresa }
  );
  return data as IPaciente[];
}

export async function getPodologos(): Promise<IUser[]> {
  const cookieStore = await cookies();
  const { id_sucursal: jwtSucursal, id_empresa } = await getActiveUser();
  const selCookie = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
  const id_sucursal = selCookie > 0 ? selCookie : jwtSucursal;
  const data = await db.queryParams(
    `SELECT [id_user]
           ,[nombre]
           ,[email]
           ,[telefono]
           ,[password_hash]
           ,[id_role]
           ,[status]
           ,CONVERT(varchar(19), [created_at], 120) AS created_at
           ,CONVERT(varchar(19), [updated_at], 120) AS updated_at
           ,CONVERT(varchar(19), [deleted_at], 120) AS deleted_at
           ,[id_sucursal]
           ,[id_empresa]
       FROM [CentroPodologico].[dbo].[users]
      WHERE [id_sucursal] = @id_sucursal
        AND [id_empresa]  = @id_empresa`,
    { id_sucursal, id_empresa }
  );
  return data as IUser[];
}

export async function saveCita(
  form: ICita
): Promise<{ ok: boolean; message?: string }> {
  try {
    const {
      id_cita,
      id_paciente,
      id_podologo,
      fecha_inicio,
      fecha_fin,
      estado,
      motivo_cancelacion,
      created_at,
      deleted_at,
      id_sucursal,
      id_empresa,
    } = form;

    const commonParams = {
      id_paciente,
      id_podologo,
      fecha_inicio:       toDBString(String(fecha_inicio       ?? "")),
      fecha_fin:          toDBString(String(fecha_fin          ?? "")),
      estado,
      motivo_cancelacion,
      created_at:         toDBString(String(created_at ?? "")) ?? buildDate(new Date()),
      deleted_at:         toDBString(String(deleted_at          ?? "")),
      id_sucursal,
      id_empresa,
    };

    if (id_cita === 0) {
      await db.queryParams(
        `INSERT INTO [CentroPodologico].[dbo].[citas]
           ([id_cita],[id_paciente],[id_podologo],[fecha_inicio],[fecha_fin],
            [estado],[motivo_cancelacion],[created_at],[deleted_at],[id_sucursal],[id_empresa])
         VALUES (
           (SELECT ISNULL(MAX([id_cita]),0)+1 FROM [CentroPodologico].[dbo].[citas]),
           @id_paciente,@id_podologo,@fecha_inicio,@fecha_fin,
           @estado,@motivo_cancelacion,@created_at,@deleted_at,@id_sucursal,@id_empresa
         )`,
        commonParams
      );
    } else {
      await db.queryParams(
        `UPDATE [CentroPodologico].[dbo].[citas] SET
           [id_paciente]        = @id_paciente,
           [id_podologo]        = @id_podologo,
           [fecha_inicio]       = @fecha_inicio,
           [fecha_fin]          = @fecha_fin,
           [estado]             = @estado,
           [motivo_cancelacion] = @motivo_cancelacion,
           [created_at]         = @created_at,
           [deleted_at]         = @deleted_at,
           [id_sucursal]        = @id_sucursal,
           [id_empresa]         = @id_empresa
         WHERE [id_cita] = @id_cita`,
        { id_cita, ...commonParams }
      );
    }

    revalidatePath("/dashboard/citas");
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al guardar la cita" };
  }
}
