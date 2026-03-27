import db from "@/database/connection";
import { IArchivo } from "@/interfaces/archivos";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);
    const id_consulta = searchParams.get("id_consulta");

    let resp;
    if (id_consulta) {
      resp = await db.queryParams(`
        SELECT [id_archivo],[id_consulta],[ruta],[tipo]
              ,CONVERT(varchar(19), [created_at], 120) AS created_at
              ,[categoria]
          FROM [CentroPodologico].[dbo].[archivos]
         WHERE [id_consulta] = @id_consulta
         ORDER BY [id_archivo] DESC
      `, { id_consulta: Number(id_consulta) });
    } else {
      resp = await db.query(`
        SELECT [id_archivo]
              ,[id_consulta]
              ,[ruta]
              ,[tipo]
              ,[created_at]
              ,[categoria]
          FROM [CentroPodologico].[dbo].[archivos]
      `);
    }

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
    const body: IArchivo = await req.json();

    const {
      id_archivo,
      id_consulta,
      ruta,
      tipo,
      created_at,
      categoria,
    } = body;

    const commonParams = {
      id_consulta,
      ruta,
      tipo,
      created_at,
      categoria,
    };

    let result;

    if (id_archivo === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[archivos]
          ([id_archivo],[id_consulta],[ruta],[tipo],[created_at],[categoria])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_archivo]),0)+1 FROM [CentroPodologico].[dbo].[archivos]),
          @id_consulta,@ruta,@tipo,@created_at,@categoria
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[archivos] SET
          [id_consulta] = @id_consulta,
          [ruta]        = @ruta,
          [tipo]        = @tipo,
          [created_at]  = @created_at,
          [categoria]   = @categoria
        OUTPUT INSERTED.*
        WHERE [id_archivo] = @id_archivo
      `, { id_archivo, ...commonParams });
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
