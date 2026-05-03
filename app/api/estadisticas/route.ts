import db from "@/database/connection";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { IAuthUser } from "@/interfaces/auth";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

async function getActiveUser(): Promise<IAuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) throw new Error("No autenticado");
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as IAuthUser;
}

export const GET = async (req: Request) => {
  try {
    const user = await getActiveUser();
    const { id_empresa } = user;

    const { searchParams } = new URL(req.url);
    const fecha_inicio = searchParams.get("fecha_inicio");
    const fecha_fin = searchParams.get("fecha_fin");
    const paramSucursal = Number(searchParams.get("id_sucursal") ?? 0);

    // Prefer explicit query param; fall back to cookie, then user default
    let id_sucursal: number;
    if (paramSucursal > 0) {
      id_sucursal = paramSucursal;
    } else {
      const cookieStore = await cookies();
      const selCookie = Number(cookieStore.get("sel_sucursal")?.value ?? 0);
      id_sucursal = selCookie > 0 ? selCookie : user.id_sucursal;
    }

    if (!fecha_inicio || !fecha_fin) {
      return NextResponse.json(
        { ok: false, message: "fecha_inicio y fecha_fin son requeridos" },
        { status: 400 }
      );
    }

    const [servicios, productos, metodos_pago, ventas_mensuales] = await Promise.all([
      // 1. Servicios usados en consultas dentro del rango
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

      // 2. Productos usados en consultas dentro del rango
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

      // 3. Métodos de pago usados en el rango
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

      // 4. Ventas mensuales (servicios + productos por mes)
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

    return NextResponse.json({ ok: true, servicios, productos, metodos_pago, ventas_mensuales });
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { ok: false, message: "Error al obtener estadísticas" },
      { status: 500 }
    );
  }
};
