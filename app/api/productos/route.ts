import db from "@/database/connection";
import { IProducto } from "@/interfaces/producto";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const resp = await db.query(`
      SELECT [id_producto]
            ,[nombre]
            ,[precio]
            ,[status]
            ,[created_at]
            ,[id_empresa]
        FROM [CentroPodologico].[dbo].[productos]
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
    const body: IProducto = await req.json();

    const {
      id_producto,
      nombre,
      precio,
      status,
      created_at,
      id_empresa,
    } = body;

    const commonParams = {
      nombre,
      precio,
      status,
      created_at,
      id_empresa,
    };

    let result;

    if (id_producto === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[productos]
          ([id_producto],[nombre],[precio],[status],[created_at],[id_empresa])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_producto]),0)+1 FROM [CentroPodologico].[dbo].[productos]),
          @nombre,@precio,@status,@created_at,@id_empresa
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[productos] SET
          [nombre]     = @nombre,
          [precio]     = @precio,
          [status]     = @status,
          [created_at] = @created_at,
          [id_empresa] = @id_empresa
        OUTPUT INSERTED.*
        WHERE [id_producto] = @id_producto
      `, { id_producto, ...commonParams });
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
