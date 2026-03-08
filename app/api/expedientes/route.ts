import db from "@/database/connection";
import { IExpediente } from "@/interfaces/expediente";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const resp = await db.query(`
      SELECT [id_expediente]
            ,[id_paciente]
            ,[antecedentes]
            ,[alergias]
            ,[enfermedades_cronicas]
            ,[created_at]
            ,[updated_at]
        FROM [CentroPodologico].[dbo].[expedientes]
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
    const body: IExpediente = await req.json();

    const {
      id_expediente,
      id_paciente,
      antecedentes,
      alergias,
      enfermedades_cronicas,
      created_at,
      updated_at,
    } = body;

    const commonParams = {
      id_paciente,
      antecedentes,
      alergias,
      enfermedades_cronicas,
      created_at,
      updated_at,
    };

    let result;

    if (id_expediente === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[expedientes]
          ([id_expediente],[id_paciente],[antecedentes],[alergias],[enfermedades_cronicas],[created_at],[updated_at])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_expediente]),0)+1 FROM [CentroPodologico].[dbo].[expedientes]),
          @id_paciente,@antecedentes,@alergias,@enfermedades_cronicas,@created_at,@updated_at
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[expedientes] SET
          [id_paciente]          = @id_paciente,
          [antecedentes]         = @antecedentes,
          [alergias]             = @alergias,
          [enfermedades_cronicas]= @enfermedades_cronicas,
          [created_at]           = @created_at,
          [updated_at]           = @updated_at
        OUTPUT INSERTED.*
        WHERE [id_expediente] = @id_expediente
      `, { id_expediente, ...commonParams });
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
