import db from "@/database/connection";
import { IServicio } from "@/interfaces/servicio";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const resp = await db.query(`
      SELECT [id_servicio]
            ,[nombre]
            ,[status]
            ,[cretated_at]
            ,[id_empresa]
        FROM [CentroPodologico].[dbo].[servicios]
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
    const body: IServicio = await req.json();

    const {
      id_servicio,
      nombre,
      status,
      cretated_at,
      id_empresa,
    } = body;

    const commonParams = {
      nombre,
      status,
      cretated_at,
      id_empresa,
    };

    let result;

    if (id_servicio === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[servicios]
          ([id_servicio],[nombre],[status],[cretated_at],[id_empresa])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_servicio]),0)+1 FROM [CentroPodologico].[dbo].[servicios]),
          @nombre,@status,@cretated_at,@id_empresa
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[servicios] SET
          [nombre]      = @nombre,
          [status]      = @status,
          [cretated_at] = @cretated_at,
          [id_empresa]  = @id_empresa
        OUTPUT INSERTED.*
        WHERE [id_servicio] = @id_servicio
      `, { id_servicio, ...commonParams });
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
