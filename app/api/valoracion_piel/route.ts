import db from "@/database/connection";
import { IValoracionPiel } from "@/interfaces/valoracion_piel";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const resp = await db.query(`
      SELECT [id_valoracion_piel]
            ,[id_consulta]
            ,[fecha_valoracion]
            ,[edema]
            ,[dermatomicosis]
            ,[pie_atleta]
            ,[bromhidrosis]
            ,[hiperdrosis]
            ,[anhidrosis]
            ,[hiperqueratosis]
            ,[helomas]
            ,[verrugas]
            ,[observaciones]
            ,[status]
            ,[created_at]
        FROM [CentroPodologico].[dbo].[valoracion_piel]
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
    const body: IValoracionPiel = await req.json();

    const {
      id_valoracion_piel,
      id_consulta,
      fecha_valoracion,
      edema,
      dermatomicosis,
      pie_atleta,
      bromhidrosis,
      hiperdrosis,
      anhidrosis,
      hiperqueratosis,
      helomas,
      verrugas,
      observaciones,
      status,
      created_at,
    } = body;

    const commonParams = {
      id_consulta,
      fecha_valoracion,
      edema,
      dermatomicosis,
      pie_atleta,
      bromhidrosis,
      hiperdrosis,
      anhidrosis,
      hiperqueratosis,
      helomas,
      verrugas,
      observaciones,
      status,
      created_at,
    };

    let result;

    if (id_valoracion_piel === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[valoracion_piel]
          ([id_valoracion_piel],[id_consulta],[fecha_valoracion],[edema],[dermatomicosis],
           [pie_atleta],[bromhidrosis],[hiperdrosis],[anhidrosis],[hiperqueratosis],
           [helomas],[verrugas],[observaciones],[status],[created_at])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_valoracion_piel]),0)+1 FROM [CentroPodologico].[dbo].[valoracion_piel]),
          @id_consulta,@fecha_valoracion,@edema,@dermatomicosis,
          @pie_atleta,@bromhidrosis,@hiperdrosis,@anhidrosis,@hiperqueratosis,
          @helomas,@verrugas,@observaciones,@status,@created_at
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[valoracion_piel] SET
          [id_consulta]      = @id_consulta,
          [fecha_valoracion] = @fecha_valoracion,
          [edema]            = @edema,
          [dermatomicosis]   = @dermatomicosis,
          [pie_atleta]       = @pie_atleta,
          [bromhidrosis]     = @bromhidrosis,
          [hiperdrosis]      = @hiperdrosis,
          [anhidrosis]       = @anhidrosis,
          [hiperqueratosis]  = @hiperqueratosis,
          [helomas]          = @helomas,
          [verrugas]         = @verrugas,
          [observaciones]    = @observaciones,
          [status]           = @status,
          [created_at]       = @created_at
        OUTPUT INSERTED.*
        WHERE [id_valoracion_piel] = @id_valoracion_piel
      `, { id_valoracion_piel, ...commonParams });
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
