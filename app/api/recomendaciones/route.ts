import db from "@/database/connection";
import { IRecomendacion } from "@/interfaces/recomendacion";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const resp = await db.query(`
      SELECT [id_recomendacion]
            ,[codigo_condicion]
            ,[titulo]
            ,[contenido]
            ,[created_at]
            ,[status]
        FROM [CentroPodologico].[dbo].[recomendaciones]
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
    const body: IRecomendacion = await req.json();

    const {
      id_recomendacion,
      codigo_condicion,
      titulo,
      contenido,
      created_at,
      status,
    } = body;

    const commonParams = {
      codigo_condicion,
      titulo,
      contenido,
      created_at,
      status,
    };

    let result;

    if (id_recomendacion === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[recomendaciones]
          ([id_recomendacion],[codigo_condicion],[titulo],[contenido],[created_at],[status])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_recomendacion]),0)+1 FROM [CentroPodologico].[dbo].[recomendaciones]),
          @codigo_condicion,@titulo,@contenido,@created_at,@status
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[recomendaciones] SET
          [codigo_condicion] = @codigo_condicion,
          [titulo]           = @titulo,
          [contenido]        = @contenido,
          [created_at]       = @created_at,
          [status]           = @status
        OUTPUT INSERTED.*
        WHERE [id_recomendacion] = @id_recomendacion
      `, { id_recomendacion, ...commonParams });
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
