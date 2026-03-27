import db from "@/database/connection";
import { IConsulta } from "@/interfaces/consulta";
import { toDBString } from "@/utils/date_helpper";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);
    const id_paciente  = searchParams.get("id_paciente");
    const id_consulta  = searchParams.get("id_consulta");

    let resp;
    if (id_consulta) {
      resp = await db.queryParams(`
        SELECT [id_consulta]
              ,[id_paciente]
              ,[id_podologo]
              ,CONVERT(varchar(19), [fecha], 120) AS fecha
              ,[diagnostico]
              ,[tratamiento_aplicado]
              ,[observaciones]
              ,CONVERT(varchar(19), [created_at], 120) AS created_at
              ,[deleted_at]
              ,[costo_total]
              ,[id_sucursal]
              ,[id_empresa]
          FROM [CentroPodologico].[dbo].[consultas]
         WHERE [id_consulta] = @id_consulta
           AND [deleted_at] IS NULL
      `, { id_consulta: Number(id_consulta) });
    } else if (id_paciente) {
      resp = await db.queryParams(`
        SELECT [id_consulta]
              ,[id_paciente]
              ,[id_podologo]
              ,CONVERT(varchar(19), [fecha], 120) AS fecha
              ,[diagnostico]
              ,[tratamiento_aplicado]
              ,[observaciones]
              ,[created_at]
              ,[deleted_at]
              ,[costo_total]
              ,[id_sucursal]
              ,[id_empresa]
          FROM [CentroPodologico].[dbo].[consultas]
         WHERE [id_paciente] = @id_paciente
           AND [deleted_at] IS NULL
         ORDER BY [fecha] DESC
      `, { id_paciente: Number(id_paciente) });
    } else {
      resp = await db.query(`
        SELECT [id_consulta]
              ,[id_paciente]
              ,[id_podologo]
              ,CONVERT(varchar(19), [fecha], 120) AS fecha
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

    const toDate = (v: Date | string | null | undefined): Date | null =>
      v ? new Date(v) : null;

    const commonParams = {
      id_paciente,
      id_podologo,
      fecha:                toDBString(String(fecha ?? '')),
      diagnostico,
      tratamiento_aplicado,
      observaciones,
      created_at:           toDate(created_at),
      deleted_at:           toDate(deleted_at),
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
