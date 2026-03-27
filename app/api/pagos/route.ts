import db from "@/database/connection";
import { IPago } from "@/interfaces/pago";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);
    const id_consulta = searchParams.get("id_consulta");

    let resp;
    if (id_consulta) {
      resp = await db.queryParams(`
        SELECT [id_pago],[id_consulta],[monto],[metodo_pago]
              ,CONVERT(varchar(10), [fecha_pago], 120) AS fecha_pago
              ,[referencia]
              ,CONVERT(varchar(19), [created_at], 120) AS created_at
              ,[id_empresa]
          FROM [CentroPodologico].[dbo].[pagos]
         WHERE [id_consulta] = @id_consulta
         ORDER BY [id_pago] DESC
      `, { id_consulta: Number(id_consulta) });
    } else {
      resp = await db.query(`
        SELECT [id_pago]
              ,[id_consulta]
              ,[monto]
              ,[metodo_pago]
              ,[fecha_pago]
              ,[referencia]
              ,[created_at]
              ,[id_empresa]
          FROM [CentroPodologico].[dbo].[pagos]
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
    const body: IPago = await req.json();

    const {
      id_pago,
      id_consulta,
      monto,
      metodo_pago,
      fecha_pago,
      referencia,
      created_at,
      id_empresa,
    } = body;

    const commonParams = {
      id_consulta,
      monto,
      metodo_pago,
      fecha_pago,
      referencia,
      created_at,
      id_empresa,
    };

    let result;

    if (id_pago === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[pagos]
          ([id_pago],[id_consulta],[monto],[metodo_pago],[fecha_pago],[referencia],[created_at],[id_empresa])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_pago]),0)+1 FROM [CentroPodologico].[dbo].[pagos]),
          @id_consulta,@monto,@metodo_pago,@fecha_pago,@referencia,@created_at,@id_empresa
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[pagos] SET
          [id_consulta] = @id_consulta,
          [monto]       = @monto,
          [metodo_pago] = @metodo_pago,
          [fecha_pago]  = @fecha_pago,
          [referencia]  = @referencia,
          [created_at]  = @created_at,
          [id_empresa]  = @id_empresa
        OUTPUT INSERTED.*
        WHERE [id_pago] = @id_pago
      `, { id_pago, ...commonParams });
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
