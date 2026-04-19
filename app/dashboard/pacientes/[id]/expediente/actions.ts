"use server";

import db from "@/database/connection";
import { IAntecedenteMedico } from "@/interfaces/antecedentes";
import { IConsulta } from "@/interfaces/consulta";
import { IPaciente } from "@/interfaces/paciente";
import { ISucursal } from "@/interfaces/sucursal";
import { IUser } from "@/interfaces/user";
import { IAuthUser } from "@/interfaces/auth";
import { buildDate, toDBString } from "@/utils/date_helpper";
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

export async function getPacienteById(id_paciente: number): Promise<IPaciente | null> {
  const data = await db.queryParams(
    `SELECT [id_paciente], [nombre], [telefono],
            CONVERT(varchar(10), [fecha_nacimiento], 120) AS fecha_nacimiento,
            [direccion], [observaciones_generales], [created_at], [updated_at], [deleted_at],
            [apellido_paterno], [apellido_materno], [sexo], [whatsapp], [ciudad_preferida],
            [contacto_emergencia_nombre], [contacto_emergencia_whatsapp],
            [id_sucursal], [id_empresa]
       FROM [CentroPodologico].[dbo].[pacientes]
      WHERE [id_paciente] = @id_paciente`,
    { id_paciente }
  );
  return (data as IPaciente[])[0] ?? null;
}

export async function getAntecedentesByPaciente(id_paciente: number): Promise<IAntecedenteMedico[]> {
  const data = await db.queryParams(
    `SELECT [id_antecedente_medico], [id_paciente],
            CONVERT(varchar(10), [fecha_registro], 120) AS fecha_registro,
            [alergia_anestesia], [alergia_antibioticos], [alergia_sulfas], [alergia_latex],
            [alergia_ninguna], [diabetico], [hipertenso], [hipotiroidismo], [cancer],
            [embarazada], [lactando], [fracturas], [antecedentes_dermatologicos],
            [medicamentos_actuales], [tipo_sangre], [otros]
       FROM [CentroPodologico].[dbo].[antecedentes_medicos]
      WHERE [id_paciente] = @id_paciente`,
    { id_paciente }
  );
  return data as IAntecedenteMedico[];
}

export async function getConsultasByPaciente(id_paciente: number): Promise<IConsulta[]> {
  const data = await db.queryParams(
    `SELECT c.[id_consulta], c.[id_paciente], c.[id_podologo],
            CONVERT(varchar(19), c.[fecha], 120) AS fecha,
            c.[diagnostico], c.[tratamiento_aplicado], c.[observaciones],
            c.[created_at], c.[deleted_at], c.[costo_total], c.[id_sucursal], c.[id_empresa],
            u.[nombre] AS nombre_podologo
       FROM [CentroPodologico].[dbo].[consultas] c
       LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.[id_user] = c.[id_podologo]
      WHERE c.[id_paciente] = @id_paciente
        AND c.[deleted_at] IS NULL
      ORDER BY c.[fecha] DESC`,
    { id_paciente }
  );
  return data as IConsulta[];
}

export async function saveConsulta(form: IConsulta): Promise<{ ok: boolean; data?: IConsulta | string }> {
  try {
    const {
      id_consulta, id_paciente, id_podologo, fecha, diagnostico,
      tratamiento_aplicado, observaciones, costo_total, id_sucursal, id_empresa,
    } = form;

    const commonParams = {
      id_paciente,
      id_podologo,
      fecha:                toDBString(String(fecha ?? "")),
      diagnostico,
      tratamiento_aplicado,
      observaciones,
      created_at:           buildDate(new Date()),
      deleted_at:           null,
      costo_total,
      id_sucursal,
      id_empresa,
    };

    let result;
    if (id_consulta === 0) {
      result = await db.queryParams(
        `INSERT INTO [CentroPodologico].[dbo].[consultas]
           ([id_consulta],[id_paciente],[id_podologo],[fecha],[diagnostico],
            [tratamiento_aplicado],[observaciones],[created_at],[deleted_at],
            [costo_total],[id_sucursal],[id_empresa])
         OUTPUT INSERTED.*
         VALUES (
           (SELECT ISNULL(MAX([id_consulta]),0)+1 FROM [CentroPodologico].[dbo].[consultas]),
           @id_paciente,@id_podologo,@fecha,@diagnostico,
           @tratamiento_aplicado,@observaciones,@created_at,@deleted_at,
           @costo_total,@id_sucursal,@id_empresa
         )`,
        commonParams
      );
      const newConsulta = (result as IConsulta[])?.[0];
      if (newConsulta?.id_consulta) {
        await db.queryParams(
          `INSERT INTO [CentroPodologico].[dbo].[procesos]
             ([id_proceso],[id_consulta],[valoracion_piel],[patologia_ungueal],
              [servicios],[productos],[fotos_valoracion],[fotos_pedicure],[pagar])
           VALUES (
             (SELECT ISNULL(MAX([id_proceso]),0)+1 FROM [CentroPodologico].[dbo].[procesos]),
             @id_consulta,0,0,0,0,0,0,0
           )`,
          { id_consulta: newConsulta.id_consulta }
        );
      }
    } else {
      result = await db.queryParams(
        `UPDATE [CentroPodologico].[dbo].[consultas] SET
           [id_paciente]          = @id_paciente,
           [id_podologo]          = @id_podologo,
           [fecha]                = @fecha,
           [diagnostico]          = @diagnostico,
           [tratamiento_aplicado] = @tratamiento_aplicado,
           [observaciones]        = @observaciones,
           [created_at]           = @created_at,
           [deleted_at]           = @deleted_at,
           [costo_total]          = @costo_total,
           [id_sucursal]          = @id_sucursal,
           [id_empresa]           = @id_empresa
         OUTPUT INSERTED.*
         WHERE [id_consulta] = @id_consulta`,
        { id_consulta, ...commonParams }
      );
    }

    return { ok: true, data: (result as IConsulta[])?.[0] ?? undefined };
  } catch {
    return { ok: false, data: "Error al guardar la consulta" };
  }
}

export async function getPodologos(): Promise<IUser[]> {
  const { id_sucursal, id_empresa } = await getActiveUser();
  const data = await db.queryParams(
    `SELECT [id_user], [nombre], [email], [telefono], [id_role], [status],
            [id_sucursal], [id_empresa]
       FROM [CentroPodologico].[dbo].[users]
      WHERE [id_role]    = 2
        AND [status]     = 1
        AND [id_sucursal] = @id_sucursal
        AND [id_empresa]  = @id_empresa`,
    { id_sucursal, id_empresa }
  );
  return data as IUser[];
}

export async function getPodologosBySucursal(id_sucursal: number): Promise<IUser[]> {
  const { id_empresa } = await getActiveUser();
  const data = await db.queryParams(
    `SELECT [id_user], [nombre], [email], [telefono], [id_role], [status],
            [id_sucursal], [id_empresa]
       FROM [CentroPodologico].[dbo].[users]
      WHERE [id_role]    = 2
        AND [status]     = 1
        AND [id_sucursal] = @id_sucursal
        AND [id_empresa]  = @id_empresa`,
    { id_sucursal, id_empresa }
  );
  return data as IUser[];
}

export async function getSucursalesActivas(): Promise<ISucursal[]> {
  const { id_empresa } = await getActiveUser();
  const data = await db.queryParams(
    `SELECT [id_sucursal], [id_empresa], [nombre], [ciudad], [direccion], [telefono], [activo],
            CONVERT(varchar(19), [created_at], 120) AS created_at, [status]
       FROM [CentroPodologico].[dbo].[sucursales]
      WHERE 
      --[activo]    = 1  AND 
      [status]    = 1
        AND [id_empresa] = @id_empresa`,
    { id_empresa }
  );
  return data as ISucursal[];
}
