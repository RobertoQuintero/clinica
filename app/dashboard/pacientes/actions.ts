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
    `SELECT TOP 20 p.[id_paciente],
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
            s.[nombre] AS nombre_sucursal,
            ISNULL((SELECT TOP 1 iif(dt.id_stage=5,'Finalizado','Tratamiento')
                      FROM [CentroPodologico].[dbo].[consultas] DC
                      JOIN [CentroPodologico].[dbo].[Tratamiento_onicomicosis] DT
                        ON DT.[id_consulta] = DC.[id_consulta]
                     WHERE DC.[id_paciente] = p.[id_paciente]
                       AND ISNULL(DT.[id_tratamiento], 0) > 0
                       AND DT.[id_stage] < 6
                       order by dt.id_tratamiento desc
                       ) , '') AS en_tratamiento_onicomicosis,
            CASE WHEN uc.[onicomicosis_grado_1] = 1 OR uc.[onicomicosis_grado_2] = 1
                 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS onicomicosis_ultima_consulta,
            CASE WHEN uc.[onicocriptosis] = 1
                 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS onicocriptosis_ultima_consulta
       FROM [CentroPodologico].[dbo].[pacientes] p
       LEFT JOIN [CentroPodologico].[dbo].[sucursales] s
         ON s.[id_sucursal] = p.[id_sucursal] AND s.[id_empresa] = p.[id_empresa]
       OUTER APPLY (
         SELECT TOP 1 pu.[onicomicosis_grado_1], pu.[onicomicosis_grado_2], pu.[onicocriptosis]
           FROM [CentroPodologico].[dbo].[consultas] c
           LEFT JOIN [CentroPodologico].[dbo].[patologia_ungueal] pu
             ON pu.[id_consulta] = c.[id_consulta]
          WHERE c.[id_paciente] = p.[id_paciente]
            AND c.[deleted_at] IS NULL
            AND ISNULL(c.[cancelada], 0) = 0
          ORDER BY c.[fecha] DESC
       ) uc
      WHERE p.[id_sucursal] = @id_sucursal
        AND p.[id_empresa]  = @id_empresa
        ORDER BY p.[created_at] DESC`,
    { id_sucursal, id_empresa }
  );
  return data as IPaciente[];
}

/** Fila para exportar a Excel. Sin datos sensibles más allá de whatsapp. */
export interface IPacienteExportRow {
  nombre_completo: string; // nombre + apellido_paterno + apellido_materno
  whatsapp: string;
  nombre_sucursal: string;
}

export interface IPacienteExportResult {
  rows: IPacienteExportRow[];
  nombre_sucursal: string; // para armar el nombre del archivo, aunque no haya filas
}

export async function exportPacientesSucursal(): Promise<IPacienteExportResult> {
  const cookieStore = await cookies();
  const { id_sucursal: jwtSucursal, id_empresa } = await getActiveUser();
  const selCookie = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
  const id_sucursal = selCookie > 0 ? selCookie : jwtSucursal;

  const data = await db.queryParams(
    `SELECT p.[nombre],
            p.[apellido_paterno],
            p.[apellido_materno],
            p.[whatsapp],
            s.[nombre] AS nombre_sucursal
       FROM [CentroPodologico].[dbo].[pacientes] p
       LEFT JOIN [CentroPodologico].[dbo].[sucursales] s
         ON s.[id_sucursal] = p.[id_sucursal] AND s.[id_empresa] = p.[id_empresa]
      WHERE p.[id_sucursal] = @id_sucursal
        AND p.[id_empresa]  = @id_empresa
      ORDER BY p.[apellido_paterno], p.[nombre]`,
    { id_sucursal, id_empresa }
  ) as {
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string;
    whatsapp: string;
    nombre_sucursal: string | null;
  }[];

  const nombreSucursal =
    data[0]?.nombre_sucursal ??
    (
      await db.queryParams(
        `SELECT [nombre] FROM [CentroPodologico].[dbo].[sucursales]
          WHERE [id_sucursal] = @id_sucursal AND [id_empresa] = @id_empresa`,
        { id_sucursal, id_empresa }
      ) as { nombre: string }[]
    )[0]?.nombre ??
    "";

  const rows: IPacienteExportRow[] = data.map((row) => ({
    nombre_completo: [row.nombre, row.apellido_paterno, row.apellido_materno]
      .map((part) => (part ?? "").trim())
      .filter((part) => part.length > 0)
      .join(" "),
    whatsapp: row.whatsapp,
    nombre_sucursal: row.nombre_sucursal ?? "",
  }));

  return { rows, nombre_sucursal: nombreSucursal };
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
            s.[nombre] AS nombre_sucursal,
            ISNULL((SELECT TOP 1 'Tratamiento'
                      FROM [CentroPodologico].[dbo].[consultas] DC
                      JOIN [CentroPodologico].[dbo].[Tratamiento_onicomicosis] DT
                        ON DT.[id_consulta] = DC.[id_consulta]
                     WHERE DC.[id_paciente] = p.[id_paciente]
                       AND ISNULL(DT.[id_tratamiento], 0) > 0
                       AND DT.[id_stage] < 5), '') AS en_tratamiento_onicomicosis,
            CASE WHEN uc.[onicomicosis_grado_1] = 1 OR uc.[onicomicosis_grado_2] = 1
                 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS onicomicosis_ultima_consulta,
            CASE WHEN uc.[onicocriptosis] = 1
                 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS onicocriptosis_ultima_consulta
       FROM [CentroPodologico].[dbo].[pacientes] p
       LEFT JOIN [CentroPodologico].[dbo].[sucursales] s
         ON s.[id_sucursal] = p.[id_sucursal] AND s.[id_empresa] = p.[id_empresa]
       OUTER APPLY (
         SELECT TOP 1 pu.[onicomicosis_grado_1], pu.[onicomicosis_grado_2], pu.[onicocriptosis]
           FROM [CentroPodologico].[dbo].[consultas] c
           LEFT JOIN [CentroPodologico].[dbo].[patologia_ungueal] pu
             ON pu.[id_consulta] = c.[id_consulta]
          WHERE c.[id_paciente] = p.[id_paciente]
            AND c.[deleted_at] IS NULL
            AND ISNULL(c.[cancelada], 0) = 0
          ORDER BY c.[fecha] DESC
       ) uc
      WHERE p.[id_empresa] = @id_empresa
        AND ${wordClauses.join(" AND ")}`,

    params
  );
  return data as IPaciente[];
}

export async function buscarPacientesPorSucursal(query: string): Promise<IPaciente[]> {
  if (!query.trim()) return [];
  const cookieStore = await cookies();
  const { id_sucursal: jwtSucursal, id_empresa } = await getActiveUser();
  const selCookie = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
  const id_sucursal = selCookie > 0 ? selCookie : jwtSucursal;

  const words = query.trim().split(/\s+/).slice(0, 5);
  const params: Record<string, unknown> = { id_sucursal, id_empresa };
  const wordClauses = words.map((word, i) => {
    params[`q${i}`] = `%${word}%`;
    return `(p.[nombre] LIKE @q${i} OR p.[apellido_paterno] LIKE @q${i} OR p.[apellido_materno] LIKE @q${i} OR p.[whatsapp] LIKE @q${i})`;
  });

  const data = await db.queryParams(
    `SELECT TOP 100
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
            s.[nombre] AS nombre_sucursal,
            ISNULL((SELECT TOP 1 'Tratamiento'
                      FROM [CentroPodologico].[dbo].[consultas] DC
                      JOIN [CentroPodologico].[dbo].[Tratamiento_onicomicosis] DT
                        ON DT.[id_consulta] = DC.[id_consulta]
                     WHERE DC.[id_paciente] = p.[id_paciente]
                       AND ISNULL(DT.[id_tratamiento], 0) > 0
                       AND DT.[id_stage] < 5), '') AS en_tratamiento_onicomicosis,
            CASE WHEN uc.[onicomicosis_grado_1] = 1 OR uc.[onicomicosis_grado_2] = 1
                 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS onicomicosis_ultima_consulta,
            CASE WHEN uc.[onicocriptosis] = 1
                 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS onicocriptosis_ultima_consulta
       FROM [CentroPodologico].[dbo].[pacientes] p
       LEFT JOIN [CentroPodologico].[dbo].[sucursales] s
         ON s.[id_sucursal] = p.[id_sucursal] AND s.[id_empresa] = p.[id_empresa]
       OUTER APPLY (
         SELECT TOP 1 pu.[onicomicosis_grado_1], pu.[onicomicosis_grado_2], pu.[onicocriptosis]
           FROM [CentroPodologico].[dbo].[consultas] c
           LEFT JOIN [CentroPodologico].[dbo].[patologia_ungueal] pu
             ON pu.[id_consulta] = c.[id_consulta]
          WHERE c.[id_paciente] = p.[id_paciente]
            AND c.[deleted_at] IS NULL
            AND ISNULL(c.[cancelada], 0) = 0
          ORDER BY c.[fecha] DESC
       ) uc
      WHERE p.[id_sucursal] = @id_sucursal
        AND p.[id_empresa]  = @id_empresa
        AND ${wordClauses.join(" AND ")}
      ORDER BY p.[apellido_paterno], p.[nombre]`,
    params
  );
  return data as IPaciente[];
}
