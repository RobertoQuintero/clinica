"use server";

import db from "@/database/connection";
import { ITratamientoOnicomicosis, ITratamientoOnicomicosisListRow } from "@/interfaces/tratamiento_onicomicosis";
import { IConsulta } from "@/interfaces/consulta";
import { IAuthUser } from "@/interfaces/auth";
import { buildDate } from "@/utils/date_helpper";
import { createWebId } from "@/utils/random";
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
  id_sucursal: number,
  id_especialista?: number
): Promise<ITratamientoOnicomicosisListRow[]> {
  const { id_empresa } = await getActiveUser();
  const especialistaFilter = id_especialista != null
    ? `AND t.[id_especialista] = @id_especialista AND t.[id_stage]<5`
    : ``;
  const data = await db.queryParams(
    `SELECT TOP 15 t.[id_tratamiento],
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
            ISNULL(s.[name], '—') AS nombre_stage,
            ISNULL(t.[new_message], 0)  AS new_message,
            t.[message],
            (SELECT COUNT(*) FROM [CentroPodologico].[dbo].[consultas] WHERE [id_tratamiento] = t.[id_tratamiento]) AS num_consultas
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
      WHERE 1=1
        ${especialistaFilter}
      ORDER BY t.[created_at] DESC`,
    { id_sucursal, id_empresa, ...(id_especialista != null ? { id_especialista } : {}) }
  );
  return data as ITratamientoOnicomicosisListRow[];
}

export async function searchTratamientos(
  id_sucursal: number,
  q: string,
  id_especialista?: number
): Promise<ITratamientoOnicomicosisListRow[]> {
  const { id_empresa } = await getActiveUser();
  const especialistaFilter = id_especialista != null
    ? `AND t.[id_especialista] = @id_especialista AND t.[id_stage]<5`
    : ``;
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
            ISNULL(s.[name], '—') AS nombre_stage,
            ISNULL(t.[new_message], 0)  AS new_message,
            t.[message],
            (SELECT COUNT(*) FROM [CentroPodologico].[dbo].[consultas] WHERE [id_tratamiento] = t.[id_tratamiento]) AS num_consultas
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
      WHERE (
        LTRIM(RTRIM(
          p.[nombre] + ' ' + p.[apellido_paterno]
          + CASE WHEN p.[apellido_materno] IS NOT NULL AND p.[apellido_materno] <> ''
                 THEN ' ' + p.[apellido_materno] ELSE '' END
        )) LIKE '%' + @q + '%'
        OR ISNULL(e.[nombre], '') LIKE '%' + @q + '%'
        OR ISNULL(p.[whatsapp], '') LIKE '%' + @q + '%'
      )
        AND c.[id_sucursal] = @id_sucursal
        AND c.[id_empresa]  = @id_empresa
        ${especialistaFilter}
      ORDER BY t.[created_at] DESC`,
    { id_sucursal, id_empresa, q, ...(id_especialista != null ? { id_especialista } : {}) }
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
  id_paciente:         number;
  id_podologo:         number;
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
            ISNULL(t.[new_message], 0) AS new_message,
            t.[message],
            c.[id_paciente] AS id_paciente,
            c.[id_podologo] AS id_podologo,
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
    id_paciente: number;
    id_podologo: number;
  })[];
  return rows[0] ?? null;
}

export async function markTratamientoRevisado(
  id_tratamiento: number
): Promise<void> {
  await db.queryParams(
    `UPDATE [CentroPodologico].[dbo].[Tratamiento_onicomicosis]
        SET [new_message] = 0,
            [message]     = ''
      WHERE [id_tratamiento] = @id_tratamiento`,
    { id_tratamiento }
  );
}

export async function updateTratamientoStage(
  id_tratamiento: number,
  id_stage: number
): Promise<void> {
  await db.queryParams(
    `UPDATE [CentroPodologico].[dbo].[Tratamiento_onicomicosis]
        SET [id_stage] = @id_stage
      WHERE [id_tratamiento] = @id_tratamiento`,
    { id_tratamiento, id_stage }
  );
}

export async function getArchivosByConsulta(
  id_consulta: number
): Promise<{ id_archivo: number; ruta: string; categoria: string }[]> {
  const data = await db.queryParams(
    `SELECT [id_archivo], [ruta], [categoria]
       FROM [CentroPodologico].[dbo].[archivos]
      WHERE [id_consulta] = @id_consulta
        AND [categoria] IN ('VALORACION_U', 'PEDICURE_U')
      ORDER BY [id_archivo]`,
    { id_consulta }
  );
  return data as { id_archivo: number; ruta: string; categoria: string }[];
}

export interface IPagoTratamientoRow {
  id_tratamiento_pago:      number;
  total:                    number;
  idMetodoPago:             number;
  created_at:               string;
  referencia:               string;
  nombre_metodo:            string;
  nombre_tipo:              string;
}

export async function getPagosByTratamiento(
  id_tratamiento: number
): Promise<IPagoTratamientoRow[]> {
  const data = await db.queryParams(
    `SELECT p.[id_tratamiento_pago],
            p.[total],
            p.[idMetodoPago],
            CONVERT(varchar(19), p.[created_at], 120) AS created_at,
            ISNULL(p.[referencia], '') AS referencia,
            ISNULL(mp.[descripcion], '—') AS nombre_metodo,
            ISNULL(tp.[name], '—') AS nombre_tipo
       FROM [CentroPodologico].[dbo].[Tratamiento_onicomicosis_pagos] p
  LEFT JOIN [CentroPodologico].[dbo].[MetodosPagos] mp
         ON mp.[idMetodoPago] = p.[idMetodoPago]
  LEFT JOIN [CentroPodologico].[dbo].[Tratamiento_pagos_tipos] tp
         ON tp.[id_tratamiento_pago_tipo] = p.[id_tratamiento_pago_tipo]
      WHERE p.[id_tratamiento] = @id_tratamiento
        AND p.[status] = 1
      ORDER BY p.[created_at] ASC`,
    { id_tratamiento }
  );
  return data as IPagoTratamientoRow[];
}

export async function getDefaultTotalTipo2(): Promise<number> {
  const rows = await db.queryParams(
    `SELECT [total]
       FROM [CentroPodologico].[dbo].[Tratamiento_pagos_tipos]
      WHERE [id_tratamiento_pago_tipo] = @id`,
    { id: 2 }
  );
  return rows.length > 0 ? Number(rows[0].total) : 0;
}

export async function getMetodosPagoTratamiento(): Promise<{ idMetodoPago: number; descripcion: string }[]> {
  const rows = await db.query(
    `SELECT [idMetodoPago], [descripcion]
       FROM [CentroPodologico].[dbo].[MetodosPagos]
      WHERE [activo] = 1 AND [eliminado] = 0`
  );
  return rows as { idMetodoPago: number; descripcion: string }[];
}

export async function createPagoTratamiento(data: {
  id_tratamiento: number;
  total:          number;
  idMetodoPago:   number;
  referencia:     string;
}): Promise<{ ok: boolean; message?: string }> {
  try {
    const { id_user } = await getActiveUser();
    const created_at  = buildDate(new Date());
    const webid       = createWebId(10);

    await db.queryParams(
      `DECLARE @id_pago INT =
         (SELECT ISNULL(MAX([id_tratamiento_pago]), 0) + 1
            FROM [CentroPodologico].[dbo].[Tratamiento_onicomicosis_pagos])

       INSERT INTO [CentroPodologico].[dbo].[Tratamiento_onicomicosis_pagos]
         ([id_tratamiento_pago],[id_tratamiento],[total],[idMetodoPago],
          [status],[created_at],[facturado],[webid],[uuid_cfdi],
          [id_usuario],[id_usuario_elimino],[deleted_date],
          [id_tratamiento_pago_tipo],[referencia])
       VALUES
         (@id_pago,@id_tratamiento,@total,@idMetodoPago,
          1,@created_at,0,CONVERT(varchar,@id_pago)+'-'+@webid,NULL,
          @id_usuario,NULL,NULL,
          2,@referencia)`,
      {
        id_tratamiento: Number(data.id_tratamiento),
        total:          String(data.total),
        idMetodoPago:   Number(data.idMetodoPago),
        referencia:     data.referencia,
        created_at,
        id_usuario:     id_user,
        webid,
      }
    );
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Error al registrar el pago" };
  }
}

export async function deletePagoTratamiento(
  id_tratamiento_pago: number
): Promise<{ ok: boolean; message?: string }> {
  try {
    await db.queryParams(
      `UPDATE [CentroPodologico].[dbo].[Tratamiento_onicomicosis_pagos]
          SET [status] = 0
        WHERE [id_tratamiento_pago] = @id_tratamiento_pago`,
      { id_tratamiento_pago }
    );
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Error al eliminar el pago" };
  }
}

export async function updatePagoTratamiento(data: {
  id_tratamiento_pago: number;
  total:               number;
  idMetodoPago:        number;
  referencia:          string;
}): Promise<{ ok: boolean; message?: string }> {
  try {
    await db.queryParams(
      `UPDATE [CentroPodologico].[dbo].[Tratamiento_onicomicosis_pagos]
          SET [total]        = @total,
              [idMetodoPago] = @idMetodoPago,
              [referencia]   = @referencia
        WHERE [id_tratamiento_pago] = @id_tratamiento_pago`,
      {
        id_tratamiento_pago: Number(data.id_tratamiento_pago),
        total:               String(data.total),
        idMetodoPago:        Number(data.idMetodoPago),
        referencia:          data.referencia,
      }
    );
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Error al actualizar el pago" };
  }
}

// ─── recetas ──────────────────────────────────────────────────────────────────

export interface IRecetaTratamiento {
  id_archivo:  number;
  ruta:        string;
  tipo:        string;
  created_at:  string;
  categoria:   string;
}

export async function getRecetasByTratamiento(
  id_tratamiento: number
): Promise<IRecetaTratamiento[]> {
  const data = await db.queryParams(
    `SELECT [id_archivo],
            [ruta],
            [tipo],
            CONVERT(varchar(19), [created_at], 120) AS created_at,
            [categoria]
       FROM [CentroPodologico].[dbo].[archivos]
      WHERE [id_consulta] = @id_tratamiento
        AND [categoria]   = 'RECETA'
      ORDER BY [created_at] DESC`,
    { id_tratamiento }
  );
  return data as IRecetaTratamiento[];
}

export async function saveRecetaTratamiento(data: {
  id_tratamiento: number;
  ruta:           string;
  tipo:           string;
  created_at:     string;
}): Promise<{ ok: boolean; data?: IRecetaTratamiento; message?: string }> {
  try {
    const result = await db.queryParams(
      `INSERT INTO [CentroPodologico].[dbo].[archivos]
         ([id_archivo],[id_consulta],[ruta],[tipo],[created_at],[categoria])
       OUTPUT INSERTED.[id_archivo], INSERTED.[id_consulta],
              INSERTED.[ruta], INSERTED.[tipo],
              CONVERT(varchar(19), INSERTED.[created_at], 120) AS created_at,
              INSERTED.[categoria]
       VALUES (
         (SELECT ISNULL(MAX([id_archivo]),0)+1 FROM [CentroPodologico].[dbo].[archivos]),
         @id_tratamiento, @ruta, @tipo, @created_at, 'RECETA'
       )`,
      {
        id_tratamiento: data.id_tratamiento,
        ruta:           data.ruta,
        tipo:           data.tipo,
        created_at:     data.created_at,
      }
    );

    await db.queryParams(
      `UPDATE [CentroPodologico].[dbo].[Tratamiento_onicomicosis]
          SET [new_message] = 1,
              [message]     = 'NUEVA RECETA'
        WHERE [id_tratamiento] = @id_tratamiento`,
      { id_tratamiento: data.id_tratamiento }
    );

    return { ok: true, data: result?.[0] as IRecetaTratamiento };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Error al guardar la receta" };
  }
}

export async function getConsultasByTratamiento(
  id_tratamiento: number
): Promise<IConsulta[]> {
  const data = await db.queryParams(
    `SELECT c.[id_consulta], c.[id_paciente], c.[id_podologo],
            CONVERT(varchar(19), c.[fecha], 120) AS fecha,
            c.[diagnostico], c.[tratamiento_aplicado], c.[observaciones],
            CONVERT(varchar(19), c.[created_at], 120) AS created_at,
            CONVERT(varchar(19), c.[fecha_fin],  120) AS fecha_fin,
            c.[deleted_at], c.[costo_total], c.[id_sucursal], c.[id_empresa],
            c.[cancelada], c.[motivo_cancelada], c.[id_tratamiento],
            u.[nombre] AS nombre_podologo,
            s.[nombre] AS nombre_sucursal
       FROM [CentroPodologico].[dbo].[consultas] c
       LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.[id_user] = c.[id_podologo]
       LEFT JOIN [CentroPodologico].[dbo].[sucursales] s ON s.[id_sucursal] = c.[id_sucursal]
      WHERE c.[id_tratamiento] = @id_tratamiento
        AND c.[deleted_at] IS NULL
      ORDER BY c.[fecha] DESC`,
    { id_tratamiento }
  );
  return data as IConsulta[];
}
