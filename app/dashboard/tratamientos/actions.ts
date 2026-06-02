"use server";

import db from "@/database/connection";
import { ITratamientoOnicomicosis, ITratamientoOnicomicosisListRow } from "@/interfaces/tratamiento_onicomicosis";
import { IAuthUser } from "@/interfaces/auth";
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

export async function getTratamientos(
  id_sucursal: number
): Promise<ITratamientoOnicomicosisListRow[]> {
  const { id_empresa } = await getActiveUser();
  const data = await db.queryParams(
    `SELECT t.[id_tratamiento],
            t.[id_consulta],
            t.[id_stage],
            CONVERT(varchar(19), t.[created_at], 120) AS created_at,
            LTRIM(RTRIM(
              p.[nombre] + ' ' + p.[apellido_paterno]
              + CASE WHEN p.[apellido_materno] IS NOT NULL AND p.[apellido_materno] <> ''
                     THEN ' ' + p.[apellido_materno] ELSE '' END
            )) AS nombre_paciente,
            ISNULL(e.[nombre], '—') AS nombre_especialista,
            ISNULL(u.[nombre], '—') AS nombre_usuario,
            ISNULL(s.[name], '—') AS nombre_stage
       FROM [CentroPodologico].[dbo].[Tratamiento_onicomicosis] t
 INNER JOIN [CentroPodologico].[dbo].[consultas] c
         ON c.[id_consulta] = t.[id_consulta]
        AND c.[id_sucursal] = @id_sucursal
        AND c.[id_empresa]  = @id_empresa
 INNER JOIN [CentroPodologico].[dbo].[pacientes] p
         ON p.[id_paciente] = c.[id_paciente]
  LEFT JOIN [CentroPodologico].[dbo].[users] e
         ON e.[id_user] = t.[id_especialista]
  LEFT JOIN [CentroPodologico].[dbo].[users] u
         ON u.[id_user] = t.[id_usuario]
  LEFT JOIN [CentroPodologico].[dbo].[Tratamiento_onicomicosis_stages] s
         ON s.[id_stage] = t.[id_stage]
      ORDER BY t.[created_at] DESC`,
    { id_sucursal, id_empresa }
  );
  return data as ITratamientoOnicomicosisListRow[];
}

export async function getTratamiento(
  id_tratamiento: number
): Promise<ITratamientoOnicomicosis | null> {
  const data = await db.queryParams(
    `SELECT t.[id_tratamiento],
            t.[id_consulta],
            t.[peso],
            t.[talla],
            t.[altura],
            t.[antecedentes_cronicos],
            t.[antecedentes_hepaticos],
            t.[medicacion_actual],
            CONVERT(varchar(19), t.[created_at], 120) AS created_at,
            t.[id_stage],
            t.[id_usuario],
            t.[id_especialista]
       FROM [CentroPodologico].[dbo].[Tratamiento_onicomicosis] t
      WHERE t.[id_tratamiento] = @id_tratamiento`,
    { id_tratamiento }
  );
  const rows = data as ITratamientoOnicomicosis[];
  return rows[0] ?? null;
}

export async function getTratamientoDetalle(
  id_tratamiento: number
): Promise<(ITratamientoOnicomicosis & {
  nombre_paciente:     string;
  nombre_especialista: string;
  nombre_usuario:      string;
  nombre_stage:        string;
}) | null> {
  const data = await db.queryParams(
    `SELECT t.[id_tratamiento],
            t.[id_consulta],
            t.[peso],
            t.[talla],
            t.[altura],
            t.[antecedentes_cronicos],
            t.[antecedentes_hepaticos],
            t.[medicacion_actual],
            CONVERT(varchar(19), t.[created_at], 120) AS created_at,
            t.[id_stage],
            t.[id_usuario],
            t.[id_especialista],
            LTRIM(RTRIM(
              p.[nombre] + ' ' + p.[apellido_paterno]
              + CASE WHEN p.[apellido_materno] IS NOT NULL AND p.[apellido_materno] <> ''
                     THEN ' ' + p.[apellido_materno] ELSE '' END
            )) AS nombre_paciente,
            ISNULL(e.[nombre], '—') AS nombre_especialista,
            ISNULL(u.[nombre], '—') AS nombre_usuario,
            ISNULL(s.[name], '—') AS nombre_stage
       FROM [CentroPodologico].[dbo].[Tratamiento_onicomicosis] t
 INNER JOIN [CentroPodologico].[dbo].[consultas] c
         ON c.[id_consulta] = t.[id_consulta]
 INNER JOIN [CentroPodologico].[dbo].[pacientes] p
         ON p.[id_paciente] = c.[id_paciente]
  LEFT JOIN [CentroPodologico].[dbo].[users] e
         ON e.[id_user] = t.[id_especialista]
  LEFT JOIN [CentroPodologico].[dbo].[users] u
         ON u.[id_user] = t.[id_usuario]
  LEFT JOIN [CentroPodologico].[dbo].[Tratamiento_onicomicosis_stages] s
         ON s.[id_stage] = t.[id_stage]
      WHERE t.[id_tratamiento] = @id_tratamiento`,
    { id_tratamiento }
  );
  const rows = data as (ITratamientoOnicomicosis & {
    nombre_paciente: string;
    nombre_especialista: string;
    nombre_usuario: string;
    nombre_stage: string;
  })[];
  return rows[0] ?? null;
}
