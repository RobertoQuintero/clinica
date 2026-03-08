import db from "@/database/connection";
import { IConsultaProducto } from "@/interfaces/consulta_producto";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const resp = await db.query(`
      SELECT [id_consulta_producto]
            ,[id_consulta]
            ,[id_producto]
            ,[precio]
            ,[cantidad]
            ,[status]
            ,[created_at]
        FROM [CentroPodologico].[dbo].[consulta_productos]
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
    const body: IConsultaProducto = await req.json();

    const {
      id_consulta_producto,
      id_consulta,
      id_producto,
      precio,
      cantidad,
      status,
      created_at,
    } = body;

    const commonParams = {
      id_consulta,
      id_producto,
      precio,
      cantidad,
      status,
      created_at,
    };

    let result;

    if (id_consulta_producto === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[consulta_productos]
          ([id_consulta_producto],[id_consulta],[id_producto],[precio],[cantidad],[status],[created_at])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_consulta_producto]),0)+1 FROM [CentroPodologico].[dbo].[consulta_productos]),
          @id_consulta,@id_producto,@precio,@cantidad,@status,@created_at
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[consulta_productos] SET
          [id_consulta] = @id_consulta,
          [id_producto] = @id_producto,
          [precio]      = @precio,
          [cantidad]    = @cantidad,
          [status]      = @status,
          [created_at]  = @created_at
        OUTPUT INSERTED.*
        WHERE [id_consulta_producto] = @id_consulta_producto
      `, { id_consulta_producto, ...commonParams });
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
