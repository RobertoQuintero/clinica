"use server";

import db from "@/database/connection";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { IAuthUser } from "@/interfaces/auth";
import bcrypt from "bcryptjs";
import { buildDate, addZeroToday, toDBString } from "@/utils/date_helpper";

export interface ICitaHoy {
  id_cita:          number;
  id_paciente:      number;
  id_podologo:      number;
  fecha_inicio:     string;
  fecha_fin:        string;
  estado:           string;
  nombre_paciente:  string;
  nombre_podologo:  string;
  id_sucursal:      number;
  id_empresa:       number;
  tiene_consulta:   boolean;
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

async function getActiveUser(): Promise<IAuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) throw new Error("No autenticado");
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as IAuthUser;
}

export async function cambiarPassword(
  passwordActual: string,
  passwordNuevo: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const { id_user } = await getActiveUser();

    const rows = await db.queryParams(
      `SELECT [password_hash]
         FROM [CentroPodologico].[dbo].[users]
        WHERE [id_user] = @id_user`,
      { id_user }
    ) as { password_hash: string }[];

    if (!rows.length) {
      return { ok: false, message: "Usuario no encontrado" };
    }

    const match = await bcrypt.compare(passwordActual, rows[0].password_hash);
    if (!match) {
      return { ok: false, message: "La contraseña actual es incorrecta" };
    }

    const newHash = await bcrypt.hash(passwordNuevo, 10);

    await db.queryParams(
      `UPDATE [CentroPodologico].[dbo].[users]
          SET [password_hash] = @password_hash,
              [updated_at]    = @updated_at
        WHERE [id_user] = @id_user`,
      { password_hash: newHash, updated_at: buildDate(new Date()), id_user }
    );

    return { ok: true, message: "Contraseña actualizada correctamente" };
  } catch {
    return { ok: false, message: "Error al actualizar la contraseña" };
  }
}

export async function getTodaysCitas(): Promise<ICitaHoy[]> {
  const cookieStore = await cookies();
  const { id_sucursal: jwtSucursal, id_empresa } = await getActiveUser();
  const selCookie = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
  const id_sucursal = selCookie > 0 ? selCookie : jwtSucursal;
  const today = addZeroToday(new Date());
  const data = await db.queryParams(
    `SELECT c.[id_cita]
           ,c.[id_paciente]
           ,c.[id_podologo]
           ,CONVERT(varchar(19), c.[fecha_inicio], 120) AS fecha_inicio
           ,CONVERT(varchar(19), c.[fecha_fin],    120) AS fecha_fin
           ,c.[estado]
           ,c.[id_sucursal]
           ,c.[id_empresa]
           ,LTRIM(RTRIM(p.[nombre] + ' ' + p.[apellido_paterno]
             + CASE WHEN p.[apellido_materno] IS NOT NULL AND p.[apellido_materno] <> ''
               THEN ' ' + p.[apellido_materno] ELSE '' END)) AS nombre_paciente
           ,u.[nombre] AS nombre_podologo
           ,CASE WHEN EXISTS (
               SELECT 1 FROM [CentroPodologico].[dbo].[consultas] con
                WHERE con.[id_cita] = c.[id_cita] AND con.[deleted_at] IS NULL
             ) THEN 1 ELSE 0 END AS tiene_consulta
       FROM [CentroPodologico].[dbo].[citas] c
       LEFT JOIN [CentroPodologico].[dbo].[pacientes] p ON p.[id_paciente] = c.[id_paciente]
       LEFT JOIN [CentroPodologico].[dbo].[users]     u ON u.[id_user]     = c.[id_podologo]
      WHERE c.[id_sucursal] = @id_sucursal
        AND c.[id_empresa]  = @id_empresa
        AND c.[estado]      = 'agendada'
        AND CONVERT(varchar(10), c.[fecha_inicio], 120) = @today
      ORDER BY c.[fecha_inicio] ASC`,
    { id_sucursal, id_empresa, today }
  );
  return (data as (Omit<ICitaHoy, "tiene_consulta"> & { tiene_consulta: number })[]).map((r) => ({
    ...r,
    tiene_consulta: r.tiene_consulta === 1,
  }));
}

export async function cancelarCita(
  id_cita: number
): Promise<{ ok: boolean; message?: string }> {
  try {
    await db.queryParams(
      `UPDATE [CentroPodologico].[dbo].[citas]
          SET [estado] = 'cancelada'
        WHERE [id_cita] = @id_cita`,
      { id_cita }
    );
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al cancelar la cita" };
  }
}

export interface IConsultaBusqueda {
  id_consulta:     number;
  id_paciente:     number;
  nombre_paciente: string;
  nombre_podologo: string;
  fecha:           string;
  diagnostico:     string;
}

export async function buscarConsultaPorId(
  id_consulta: number,
): Promise<IConsultaBusqueda | null> {
  try {
    const cookieStore = await cookies();
    const { id_sucursal: jwtSucursal, id_empresa } = await getActiveUser();
    const selCookie = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
    const id_sucursal = selCookie > 0 ? selCookie : jwtSucursal;

    const rows = await db.queryParams(
      `SELECT con.[id_consulta]
             ,con.[id_paciente]
             ,LTRIM(RTRIM(p.[nombre] + ' ' + p.[apellido_paterno]
               + CASE WHEN p.[apellido_materno] IS NOT NULL AND p.[apellido_materno] <> ''
                 THEN ' ' + p.[apellido_materno] ELSE '' END)) AS nombre_paciente
             ,u.[nombre] AS nombre_podologo
             ,CONVERT(varchar(19), con.[fecha], 120) AS fecha
             ,ISNULL(con.[diagnostico], '') AS diagnostico
         FROM [CentroPodologico].[dbo].[consultas] con
         LEFT JOIN [CentroPodologico].[dbo].[pacientes] p ON p.[id_paciente] = con.[id_paciente]
         LEFT JOIN [CentroPodologico].[dbo].[users]     u ON u.[id_user]     = con.[id_podologo]
        WHERE con.[id_consulta] = @id_consulta
          AND con.[id_sucursal] = @id_sucursal
          AND con.[id_empresa]  = @id_empresa
          AND con.[deleted_at]  IS NULL`,
      { id_consulta, id_sucursal, id_empresa },
    );

    if (!rows.length) return null;
    return rows[0] as IConsultaBusqueda;
  } catch {
    return null;
  }
}

export interface IServicioStat {
  nombre: string;
  total_usos: number;
  total_ingresos: number;
}

export interface IProductoStat {
  nombre: string;
  total_cantidad: number;
  total_ingresos: number;
}

export interface IMetodoPagoStat {
  nombre: string;
  total_pagos: number;
  total_monto: number;
}

export interface IVentaMensualStat {
  mes: string;
  total_servicios: number;
  total_productos: number;
}

export interface IEstadisticasData {
  ok: boolean;
  servicios: IServicioStat[];
  productos: IProductoStat[];
  metodos_pago: IMetodoPagoStat[];
  ventas_mensuales: IVentaMensualStat[];
}

export async function getEstadisticas(
  fecha_inicio: string,
  fecha_fin: string,
  id_sucursal: number,
): Promise<IEstadisticasData> {
  try {
    const { id_empresa } = await getActiveUser();

    const [servicios, productos, metodos_pago, ventas_mensuales] = await Promise.all([
      db.queryParams(
        `SELECT
           s.[nombre]                          AS nombre,
           COUNT(cs.[id_consulta_servicio])    AS total_usos,
           SUM(cs.[precio_aplicado])           AS total_ingresos
         FROM [CentroPodologico].[dbo].[consulta_servicios] cs
         INNER JOIN [CentroPodologico].[dbo].[servicio_opciones] so
           ON cs.[id_servicio_opcion] = so.[id_servicio_opcion]
         INNER JOIN [CentroPodologico].[dbo].[servicios] s
           ON so.[id_servicio] = s.[id_servicio]
         INNER JOIN [CentroPodologico].[dbo].[consultas] c
           ON cs.[id_consulta] = c.[id_consulta]
         WHERE c.[deleted_at] IS NULL
           AND c.[id_empresa]   = @id_empresa
           AND c.[id_sucursal]  = @id_sucursal
           AND CONVERT(varchar(10), c.[fecha], 120) >= @fecha_inicio
           AND CONVERT(varchar(10), c.[fecha], 120) <= @fecha_fin
         GROUP BY s.[nombre]
         ORDER BY total_usos DESC`,
        { id_empresa, id_sucursal, fecha_inicio, fecha_fin }
      ),

      db.queryParams(
        `SELECT
           p.[nombre]                       AS nombre,
           SUM(cp.[cantidad])               AS total_cantidad,
           SUM(cp.[precio] * cp.[cantidad]) AS total_ingresos
         FROM [CentroPodologico].[dbo].[consulta_productos] cp
         INNER JOIN [CentroPodologico].[dbo].[productos] p
           ON cp.[id_producto] = p.[id_producto]
         INNER JOIN [CentroPodologico].[dbo].[consultas] c
           ON cp.[id_consulta] = c.[id_consulta]
         WHERE c.[deleted_at] IS NULL
           AND c.[id_empresa]  = @id_empresa
           AND c.[id_sucursal] = @id_sucursal
           AND CONVERT(varchar(10), c.[fecha], 120) >= @fecha_inicio
           AND CONVERT(varchar(10), c.[fecha], 120) <= @fecha_fin
         GROUP BY p.[nombre]
         ORDER BY total_cantidad DESC`,
        { id_empresa, id_sucursal, fecha_inicio, fecha_fin }
      ),

      db.queryParams(
        `SELECT
           mp.[descripcion]         AS nombre,
           COUNT(pg.[id_pago])      AS total_pagos,
           SUM(pg.[monto])          AS total_monto
         FROM [CentroPodologico].[dbo].[pagos] pg
         INNER JOIN [CentroPodologico].[dbo].[MetodosPagos] mp
           ON pg.[idMetodoPago] = mp.[idMetodoPago]
         INNER JOIN [CentroPodologico].[dbo].[consultas] c
           ON pg.[id_consulta] = c.[id_consulta]
         WHERE c.[deleted_at] IS NULL
           AND c.[id_empresa]  = @id_empresa
           AND c.[id_sucursal] = @id_sucursal
           AND CONVERT(varchar(10), pg.[fecha_pago], 120) >= @fecha_inicio
           AND CONVERT(varchar(10), pg.[fecha_pago], 120) <= @fecha_fin
         GROUP BY mp.[descripcion]
         ORDER BY total_monto DESC`,
        { id_empresa, id_sucursal, fecha_inicio, fecha_fin }
      ),

      db.queryParams(
        `SELECT
           COALESCE(s.mes, p.mes)          AS mes,
           COALESCE(s.total_servicios, 0)  AS total_servicios,
           COALESCE(p.total_productos, 0)  AS total_productos
         FROM (
           SELECT
             CONVERT(varchar(7), c.[fecha], 120)  AS mes,
             SUM(cs.[precio_aplicado])             AS total_servicios
           FROM [CentroPodologico].[dbo].[consulta_servicios] cs
           INNER JOIN [CentroPodologico].[dbo].[consultas] c
             ON cs.[id_consulta] = c.[id_consulta]
           WHERE c.[deleted_at] IS NULL
             AND c.[id_empresa]  = @id_empresa
             AND c.[id_sucursal] = @id_sucursal
             AND CONVERT(varchar(10), c.[fecha], 120) >= @fecha_inicio
             AND CONVERT(varchar(10), c.[fecha], 120) <= @fecha_fin
           GROUP BY CONVERT(varchar(7), c.[fecha], 120)
         ) s
         FULL OUTER JOIN (
           SELECT
             CONVERT(varchar(7), c.[fecha], 120)   AS mes,
             SUM(cp.[precio] * cp.[cantidad])       AS total_productos
           FROM [CentroPodologico].[dbo].[consulta_productos] cp
           INNER JOIN [CentroPodologico].[dbo].[consultas] c
             ON cp.[id_consulta] = c.[id_consulta]
           WHERE c.[deleted_at] IS NULL
             AND c.[id_empresa]  = @id_empresa
             AND c.[id_sucursal] = @id_sucursal
             AND CONVERT(varchar(10), c.[fecha], 120) >= @fecha_inicio
             AND CONVERT(varchar(10), c.[fecha], 120) <= @fecha_fin
           GROUP BY CONVERT(varchar(7), c.[fecha], 120)
         ) p ON s.mes = p.mes
         ORDER BY mes`,
        { id_empresa, id_sucursal, fecha_inicio, fecha_fin }
      ),
    ]);

    return {
      ok: true,
      servicios: servicios as IServicioStat[],
      productos: productos as IProductoStat[],
      metodos_pago: metodos_pago as IMetodoPagoStat[],
      ventas_mensuales: ventas_mensuales as IVentaMensualStat[],
    };
  } catch (error) {
    console.error({ error });
    return { ok: false, servicios: [], productos: [], metodos_pago: [], ventas_mensuales: [] };
  }
}

export async function crearConsultaDesdeCita(
  id_cita:     number,
  id_paciente: number,
  id_podologo: number,
  fecha_inicio: string,
  fecha_fin:    string,
  id_sucursal: number,
  id_empresa:  number,
): Promise<{ ok: boolean; id_consulta?: number; message?: string }> {
  try {
    const created_at = buildDate(new Date());
    const fecha      = toDBString(fecha_inicio.replace(" ", "T")) ?? fecha_inicio;
    const fecha_fin_ = toDBString(fecha_fin.replace(" ", "T"))    ?? fecha_fin;

    const inserted = await db.queryParams(
      `INSERT INTO [CentroPodologico].[dbo].[consultas]
         ([id_consulta],[id_paciente],[id_podologo],[fecha],[fecha_fin],
          [diagnostico],[tratamiento_aplicado],[observaciones],[created_at],
          [costo_total],[id_sucursal],[id_empresa],[id_cita])
       OUTPUT INSERTED.[id_consulta]
       VALUES (
         (SELECT ISNULL(MAX([id_consulta]),0)+1 FROM [CentroPodologico].[dbo].[consultas]),
         @id_paciente,@id_podologo,@fecha,@fecha_fin,
         '','' ,'',@created_at,
         0,@id_sucursal,@id_empresa,@id_cita
       )`,
      { id_paciente, id_podologo, fecha, fecha_fin: fecha_fin_, created_at, id_sucursal, id_empresa, id_cita }
    );

    const newId = (inserted[0] as { id_consulta: number }).id_consulta;

    await db.queryParams(
      `UPDATE [CentroPodologico].[dbo].[citas]
          SET [estado] = 'atendida'
        WHERE [id_cita] = @id_cita`,
      { id_cita }
    );

    await db.queryParams(
      `INSERT INTO [CentroPodologico].[dbo].[procesos]
         ([id_proceso],[id_consulta],[valoracion_piel],[patologia_ungueal],
          [servicios],[productos],[fotos_valoracion],[fotos_pedicure],[pagar])
       VALUES (
         (SELECT ISNULL(MAX([id_proceso]),0)+1 FROM [CentroPodologico].[dbo].[procesos]),
         @id_consulta,0,0,0,0,0,0,0
       )`,
      { id_consulta: newId }
    );

    return { ok: true, id_consulta: newId };
  } catch (err) {
    console.error(err);
    return { ok: false, message: "Error al crear la consulta" };
  }
}

export interface IPacienteFaltante {
  id_paciente:      number;
  nombre_paciente:  string;
  telefono:         string;
  whatsapp:         string;
  ultima_consulta:  string | null;
}

export async function getPacientesFaltantes(): Promise<IPacienteFaltante[]> {
  try {
    const cookieStore = await cookies();
    const { id_sucursal: jwtSucursal, id_empresa } = await getActiveUser();
    const selCookie   = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
    const id_sucursal = selCookie > 0 ? selCookie : jwtSucursal;

    const data = await db.queryParams(
      `SELECT
           p.[id_paciente]
          ,LTRIM(RTRIM(p.[nombre] + ' ' + p.[apellido_paterno]
            + CASE WHEN p.[apellido_materno] IS NOT NULL AND p.[apellido_materno] <> ''
              THEN ' ' + p.[apellido_materno] ELSE '' END)) AS nombre_paciente
          ,ISNULL(p.[telefono],  '') AS telefono
          ,ISNULL(p.[whatsapp],  '') AS whatsapp
          ,CONVERT(varchar(19), MAX(con.[fecha]), 120)      AS ultima_consulta
       FROM [CentroPodologico].[dbo].[pacientes] p
       LEFT JOIN [CentroPodologico].[dbo].[consultas] con
         ON con.[id_paciente]  = p.[id_paciente]
        AND con.[id_sucursal]  = @id_sucursal
        AND con.[deleted_at]  IS NULL
      WHERE p.[id_sucursal] = @id_sucursal
        AND p.[id_empresa]  = @id_empresa
        AND p.[deleted_at]  IS NULL
      GROUP BY
           p.[id_paciente], p.[nombre], p.[apellido_paterno], p.[apellido_materno],
           p.[telefono], p.[whatsapp]
      HAVING MAX(con.[fecha]) IS NULL
          OR MAX(con.[fecha]) <= DATEADD(MONTH, -2, GETDATE())
      ORDER BY MAX(con.[fecha]) ASC`,
      { id_sucursal, id_empresa }
    );

    return data as IPacienteFaltante[];
  } catch {
    return [];
  }
}

export interface IPacienteCumpleanos {
  id_paciente:      number;
  nombre_paciente:  string;
  telefono:         string;
  whatsapp:         string;
  fecha_nacimiento: string;
}

export async function getPacientesCumpleanos(): Promise<IPacienteCumpleanos[]> {
  try {
    const cookieStore = await cookies();
    const { id_sucursal: jwtSucursal, id_empresa } = await getActiveUser();
    const selCookie   = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
    const id_sucursal = selCookie > 0 ? selCookie : jwtSucursal;

    const data = await db.queryParams(
      `SELECT
           p.[id_paciente]
          ,LTRIM(RTRIM(p.[nombre] + ' ' + p.[apellido_paterno]
            + CASE WHEN p.[apellido_materno] IS NOT NULL AND p.[apellido_materno] <> ''
              THEN ' ' + p.[apellido_materno] ELSE '' END)) AS nombre_paciente
          ,ISNULL(p.[telefono],  '') AS telefono
          ,ISNULL(p.[whatsapp],  '') AS whatsapp
          ,CONVERT(varchar(10), p.[fecha_nacimiento], 120)  AS fecha_nacimiento
       FROM [CentroPodologico].[dbo].[pacientes] p
      WHERE p.[id_sucursal]      = @id_sucursal
        AND p.[id_empresa]       = @id_empresa
        AND p.[deleted_at]       IS NULL
        AND p.[fecha_nacimiento] IS NOT NULL
        AND (
          DATEADD(YEAR, DATEDIFF(YEAR, p.[fecha_nacimiento], GETDATE()),     p.[fecha_nacimiento])
            BETWEEN CAST(GETDATE() AS DATE) AND DATEADD(DAY, 7, CAST(GETDATE() AS DATE))
          OR
          DATEADD(YEAR, DATEDIFF(YEAR, p.[fecha_nacimiento], GETDATE()) + 1, p.[fecha_nacimiento])
            BETWEEN CAST(GETDATE() AS DATE) AND DATEADD(DAY, 7, CAST(GETDATE() AS DATE))
        )
      ORDER BY
           DATEPART(MONTH, p.[fecha_nacimiento]),
           DATEPART(DAY,   p.[fecha_nacimiento])`,
      { id_sucursal, id_empresa }
    );

    return data as IPacienteCumpleanos[];
  } catch {
    return [];
  }
}
