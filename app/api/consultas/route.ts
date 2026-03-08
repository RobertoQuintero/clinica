import db from "@/database/connection";
import { IConsulta } from "@/interfaces/consulta";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const resp = await db.query(`
      SELECT [id_consulta]
            ,[id_paciente]
            ,[id_podologo]
            ,[fecha]
            ,[diagnostico]
            ,[tratamiento_aplicado]
            ,[observaciones]
            ,[created_at]
            ,[deleted_at]
            ,[costo_total]
            ,[id_sucursal]
            ,[id_empresa]
        FROM [CentroPodologico].[dbo].[consultas]
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
    const body: IConsulta = await req.json();

    const {
      id_consulta,
      id_paciente,
      id_podologo,
      fecha,
      diagnostico,
      tratamiento_aplicado,
      observaciones,
      created_at,
      deleted_at,
      costo_total,
      id_sucursal,
      id_empresa,
    } = body;

    const commonParams = {
      id_paciente,
      id_podologo,
      fecha,
      diagnostico,
      tratamiento_aplicado,
      observaciones,
      created_at,
      deleted_at,
      costo_total,
      id_sucursal,
      id_empresa,
    };

    let result;

    if (id_consulta === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[consultas]
          ([id_consulta],[id_paciente],[id_podologo],[fecha],[diagnostico],
           [tratamiento_aplicado],[observaciones],[created_at],[deleted_at],
           [costo_total],[id_sucursal],[id_empresa])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_consulta]),0)+1 FROM [CentroPodologico].[dbo].[consultas]),
          @id_paciente,@id_podologo,@fecha,@diagnostico,
          @tratamiento_aplicado,@observaciones,@created_at,@deleted_at,
          @costo_total,@id_sucursal,@id_empresa
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[consultas] SET
          [id_paciente]          = @id_paciente,
          [id_podologo]          = @id_podologo,
          [fecha]                = @fecha,
          [diagnostico]          = @diagnostico,
          [tratamiento_aplicado] = @tratamiento_aplicado,
          [observaciones]        = @observaciones,
          [created_at]           = @created_at,
          [deleted_at]           = @deleted_at,
          [costo_total]          = @costo_total,
          [id_sucursal]          = @id_sucursal,
          [id_empresa]           = @id_empresa
        OUTPUT INSERTED.*
        WHERE [id_consulta] = @id_consulta
      `, { id_consulta, ...commonParams });
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
