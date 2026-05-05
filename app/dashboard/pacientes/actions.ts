"use server";

import db from "@/database/connection";
import { IPaciente } from "@/interfaces/paciente";
import { IPhoneCode } from "@/interfaces/phone_code";
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

export async function getPhoneCodes(): Promise<IPhoneCode[]> {
  const data = await db.queryParams(
    `SELECT [id_phone_code],[pais],[codigo],[bandera]
       FROM [CentroPodologico].[dbo].[codigos_telefonicos]
      ORDER BY [pais]`,
    {}
  );
  return data as IPhoneCode[];
}

export async function getPacientes(): Promise<IPaciente[]> {
  const cookieStore = await cookies();
  const { id_sucursal: jwtSucursal, id_empresa } = await getActiveUser();
  const selCookie = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
  const id_sucursal = selCookie > 0 ? selCookie : jwtSucursal;
  const data = await db.queryParams(
    `SELECT p.[id_paciente],
            p.[nombre],
            p.[telefono],
            CONVERT(varchar(10), p.[fecha_nacimiento], 120) AS fecha_nacimiento,
            p.[direccion],
            p.[observaciones_generales],
            CONVERT(varchar(19), p.[created_at], 120) AS created_at,
            CONVERT(varchar(19), p.[updated_at], 120) AS updated_at,
            CONVERT(varchar(19), p.[deleted_at], 120) AS deleted_at,
            p.[apellido_paterno],
            p.[apellido_materno],
            p.[sexo],
            p.[whatsapp],
            p.[ciudad_preferida],
            p.[contacto_emergencia_nombre],
            p.[contacto_emergencia_whatsapp],
            p.[id_sucursal],
            p.[id_empresa],
            p.[id_phone_code],
            s.[nombre] AS nombre_sucursal
       FROM [CentroPodologico].[dbo].[pacientes] p
       LEFT JOIN [CentroPodologico].[dbo].[sucursales] s
         ON s.[id_sucursal] = p.[id_sucursal] AND s.[id_empresa] = p.[id_empresa]
      WHERE p.[id_sucursal] = @id_sucursal
        AND p.[id_empresa]  = @id_empresa`,
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
      id_phone_code,
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
      id_phone_code: id_phone_code ?? null,
    };

    if (id_paciente === 0) {
      await db.queryParams(
        `INSERT INTO [CentroPodologico].[dbo].[pacientes]
           ([id_paciente],[nombre],[telefono],[fecha_nacimiento],[direccion],
            [observaciones_generales],[created_at],[updated_at],[deleted_at],
            [apellido_paterno],[apellido_materno],[sexo],[whatsapp],[ciudad_preferida],
            [contacto_emergencia_nombre],[contacto_emergencia_whatsapp],[id_sucursal],[id_empresa],
            [id_phone_code])
         VALUES (
           (SELECT ISNULL(MAX([id_paciente]),0)+1 FROM [CentroPodologico].[dbo].[pacientes]),
           @nombre,@telefono,@fecha_nacimiento,@direccion,
           @observaciones_generales,@created_at,NULL,NULL,
           @apellido_paterno,@apellido_materno,@sexo,@whatsapp,@ciudad_preferida,
           @contacto_emergencia_nombre,@contacto_emergencia_whatsapp,@id_sucursal,@id_empresa,
           @id_phone_code
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
           [id_empresa]                   = @id_empresa,
           [id_phone_code]                = @id_phone_code
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

export async function buscarPacientesExternos(query: string): Promise<IPaciente[]> {
  if (!query.trim()) return [];
  const { id_empresa } = await getActiveUser();

  // Split into words so "Alejandra Quiroz" matches nombre="Alejandra" + apellido_paterno="Quiroz"
  const words = query.trim().split(/\s+/).slice(0, 5); // cap at 5 words
  const params: Record<string, unknown> = { id_empresa };
  const wordClauses = words.map((word, i) => {
    params[`q${i}`] = `%${word}%`;
    return `(p.[nombre] LIKE @q${i} OR p.[apellido_paterno] LIKE @q${i} OR p.[apellido_materno] LIKE @q${i} OR p.[telefono] LIKE @q${i})`;
  });

  const data = await db.queryParams(
    `SELECT TOP 20
            p.[id_paciente],
            p.[nombre],
            p.[telefono],
            CONVERT(varchar(10), p.[fecha_nacimiento], 120) AS fecha_nacimiento,
            p.[direccion],
            p.[observaciones_generales],
            CONVERT(varchar(19), p.[created_at], 120) AS created_at,
            CONVERT(varchar(19), p.[updated_at], 120) AS updated_at,
            CONVERT(varchar(19), p.[deleted_at], 120) AS deleted_at,
            p.[apellido_paterno],
            p.[apellido_materno],
            p.[sexo],
            p.[whatsapp],
            p.[ciudad_preferida],
            p.[contacto_emergencia_nombre],
            p.[contacto_emergencia_whatsapp],
            p.[id_sucursal],
            p.[id_empresa],
            p.[id_phone_code],
            s.[nombre] AS nombre_sucursal
       FROM [CentroPodologico].[dbo].[pacientes] p
       LEFT JOIN [CentroPodologico].[dbo].[sucursales] s
         ON s.[id_sucursal] = p.[id_sucursal] AND s.[id_empresa] = p.[id_empresa]
      WHERE p.[id_empresa] = @id_empresa
        AND ${wordClauses.join(" AND ")}`,
    params
  );
  return data as IPaciente[];
}
