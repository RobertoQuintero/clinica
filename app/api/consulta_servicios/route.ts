import db from "@/database/connection";
import { IConsultaServicio } from "@/interfaces/consulta_servicio";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const resp = await db.query(`
      SELECT [id_consulta_servicio]
            ,[id_consulta]
            ,[id_servicio_opcion]
            ,[precio_aplicado]
        FROM [CentroPodologico].[dbo].[consulta_servicios]
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
    const body: IConsultaServicio = await req.json();

    const {
      id_consulta_servicio,
      id_consulta,
      id_servicio_opcion,
      precio_aplicado,
    } = body;

    const commonParams = {
      id_consulta,
      id_servicio_opcion,
      precio_aplicado,
    };

    let result;

    if (id_consulta_servicio === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[consulta_servicios]
          ([id_consulta_servicio],[id_consulta],[id_servicio_opcion],[precio_aplicado])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_consulta_servicio]),0)+1 FROM [CentroPodologico].[dbo].[consulta_servicios]),
          @id_consulta,@id_servicio_opcion,@precio_aplicado
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[consulta_servicios] SET
          [id_consulta]        = @id_consulta,
          [id_servicio_opcion] = @id_servicio_opcion,
          [precio_aplicado]    = @precio_aplicado
        OUTPUT INSERTED.*
        WHERE [id_consulta_servicio] = @id_consulta_servicio
      `, { id_consulta_servicio, ...commonParams });
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
