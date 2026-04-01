import db from "@/database/connection";
import { ISucursal } from "@/interfaces/sucursal";
import { toDBString, buildDate } from "@/utils/date_helpper";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);
    const id_empresa = searchParams.get("id_empresa");
    const status     = searchParams.get("status");
    const activo     = searchParams.get("activo");

    const resp = await db.queryParams(`
      SELECT [id_sucursal]
            ,[id_empresa]
            ,[nombre]
            ,[ciudad]
            ,[direccion]
            ,[telefono]
            ,[activo]
            ,CONVERT(varchar(19), [created_at], 120) AS created_at
            ,[status]
        FROM [CentroPodologico].[dbo].[sucursales]
        WHERE (@id_empresa IS NULL OR [id_empresa] = @id_empresa)
          AND (@status     IS NULL OR [status]     = @status)
          AND (@activo     IS NULL OR [activo]     = @activo)
    `, {
      id_empresa: id_empresa ? Number(id_empresa) : null,
      status:     status     ? Number(status)     : null,
      activo:     activo     ? Number(activo)     : null,
    });

    return NextResponse.json({ ok: true, data: resp });
  } catch (error) {
    console.log({ error });
    return NextResponse.json({
      ok: false,
      data: "Error en el servidor al intentar conectar con la base de datos",
    }, { status: 500 });
  }
};

export const POST = async (req: Request) => {
  try {
    const body: ISucursal = await req.json();

    const {
      id_sucursal,
      id_empresa,
      nombre,
      ciudad,
      direccion,
      telefono,
      activo,
      created_at,
      status,
    } = body;

    const commonParams = {
      id_empresa,
      nombre,
      ciudad,
      direccion,
      telefono,
      activo,
      created_at: toDBString(String(created_at ?? "")) ?? buildDate(new Date()),
      status,
    };

    let result;

    if (id_sucursal === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[sucursales]
          ([id_sucursal],[id_empresa],[nombre],[ciudad],[direccion],[telefono],[activo],[created_at],[status])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_sucursal]),0)+1 FROM [CentroPodologico].[dbo].[sucursales]),
          @id_empresa,@nombre,@ciudad,@direccion,@telefono,@activo,@created_at,@status
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[sucursales] SET
          [id_empresa]  = @id_empresa,
          [nombre]      = @nombre,
          [ciudad]      = @ciudad,
          [direccion]   = @direccion,
          [telefono]    = @telefono,
          [activo]      = @activo,
          [created_at]  = @created_at,
          [status]      = @status
        OUTPUT INSERTED.*
        WHERE [id_sucursal] = @id_sucursal
      `, { id_sucursal, ...commonParams });
    }

    return NextResponse.json({ ok: true, data: result?.[0] ?? null });
  } catch (error) {
    console.log({ error });
    return NextResponse.json({
      ok: false,
      data: "Error en el servidor al intentar conectar con la base de datos",
    }, { status: 500 });
  }
};
