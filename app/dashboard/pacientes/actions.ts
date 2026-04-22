"use server";

import db from "@/database/connection";
import { IPaciente } from "@/interfaces/paciente";
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

export async function getPacientes(): Promise<IPaciente[]> {
  const cookieStore = await cookies();
  const { id_sucursal: jwtSucursal, id_empresa } = await getActiveUser();
  const selCookie = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
  const id_sucursal = selCookie > 0 ? selCookie : jwtSucursal;
  const data = await db.queryParams(
    `SELECT [id_paciente],
            [nombre],
            [telefono],
            CONVERT(varchar(10), [fecha_nacimiento], 120) AS fecha_nacimiento,
            [direccion],
            [observaciones_generales],
            CONVERT(varchar(19), [created_at], 120) AS created_at,
            CONVERT(varchar(19), [updated_at], 120) AS updated_at,
            CONVERT(varchar(19), [deleted_at], 120) AS deleted_at,
            [apellido_paterno],
            [apellido_materno],
            [sexo],
            [whatsapp],
            [ciudad_preferida],
            [contacto_emergencia_nombre],
            [contacto_emergencia_whatsapp],
            [id_sucursal],
            [id_empresa]
       FROM [CentroPodologico].[dbo].[pacientes]
      WHERE [id_sucursal] = @id_sucursal
        AND [id_empresa]  = @id_empresa`,
    { id_sucursal, id_empresa }
  );
  return data as IPaciente[];
}

export async function savePaciente(
  form: IPaciente
): Promise<{ ok: boolean; message?: string }> {
  try {
    const {
      id_paciente,
      nombre,
      telefono,
      fecha_nacimiento,
      direccion,
      observaciones_generales,
      apellido_paterno,
      apellido_materno,
      sexo,
      whatsapp,
      ciudad_preferida,
      contacto_emergencia_nombre,
      contacto_emergencia_whatsapp,
      id_sucursal,
      id_empresa,
    } = form;

    const commonParams = {
      nombre,
      telefono,
      fecha_nacimiento: toDBString(String(fecha_nacimiento ?? "")),
      direccion,
      observaciones_generales,
      apellido_paterno,
      apellido_materno,
      sexo,
      whatsapp,
      ciudad_preferida,
      contacto_emergencia_nombre,
      contacto_emergencia_whatsapp,
      id_sucursal,
      id_empresa,
    };

    if (id_paciente === 0) {
      await db.queryParams(
        `INSERT INTO [CentroPodologico].[dbo].[pacientes]
           ([id_paciente],[nombre],[telefono],[fecha_nacimiento],[direccion],
            [observaciones_generales],[created_at],[updated_at],[deleted_at],
            [apellido_paterno],[apellido_materno],[sexo],[whatsapp],[ciudad_preferida],
            [contacto_emergencia_nombre],[contacto_emergencia_whatsapp],[id_sucursal],[id_empresa])
         VALUES (
           (SELECT ISNULL(MAX([id_paciente]),0)+1 FROM [CentroPodologico].[dbo].[pacientes]),
           @nombre,@telefono,@fecha_nacimiento,@direccion,
           @observaciones_generales,@created_at,NULL,NULL,
           @apellido_paterno,@apellido_materno,@sexo,@whatsapp,@ciudad_preferida,
           @contacto_emergencia_nombre,@contacto_emergencia_whatsapp,@id_sucursal,@id_empresa
         )`,
        { ...commonParams, created_at: buildDate(new Date()) }
      );
    } else {
      await db.queryParams(
        `UPDATE [CentroPodologico].[dbo].[pacientes] SET
           [nombre]                       = @nombre,
           [telefono]                     = @telefono,
           [fecha_nacimiento]             = @fecha_nacimiento,
           [direccion]                    = @direccion,
           [observaciones_generales]      = @observaciones_generales,
           [updated_at]                   = @updated_at,
           [apellido_paterno]             = @apellido_paterno,
           [apellido_materno]             = @apellido_materno,
           [sexo]                         = @sexo,
           [whatsapp]                     = @whatsapp,
           [ciudad_preferida]             = @ciudad_preferida,
           [contacto_emergencia_nombre]   = @contacto_emergencia_nombre,
           [contacto_emergencia_whatsapp] = @contacto_emergencia_whatsapp,
           [id_sucursal]                  = @id_sucursal,
           [id_empresa]                   = @id_empresa
         WHERE [id_paciente] = @id_paciente`,
        { id_paciente, ...commonParams, updated_at: buildDate(new Date()) }
      );
    }

    revalidatePath("/dashboard/pacientes");
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al guardar el paciente" };
  }
}
