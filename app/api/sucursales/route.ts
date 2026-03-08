import db from "@/database/connection";
import { ISucursal } from "@/interfaces/sucursal";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const resp = await db.query(`
      SELECT [id_sucursal]
            ,[id_empresa]
            ,[nombre]
            ,[ciudad]
            ,[direccion]
            ,[telefono]
            ,[activo]
            ,[created_at]
            ,[status]
        FROM [CentroPodologico].[dbo].[sucursales]
    `);

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
      created_at,
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
