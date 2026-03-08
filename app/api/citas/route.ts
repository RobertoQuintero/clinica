import db from "@/database/connection";
import { ICita } from "@/interfaces/cita";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);
    const id_sucursal = searchParams.get("id_sucursal");
    const id_empresa  = searchParams.get("id_empresa");

    const resp = await db.queryParams(`
      SELECT [id_cita]
            ,[id_paciente]
            ,[id_podologo]
            ,[fecha_inicio]
            ,[fecha_fin]
            ,[estado]
            ,[motivo_cancelacion]
            ,[created_at]
            ,[deleted_at]
            ,[id_sucursal]
            ,[id_empresa]
        FROM [CentroPodologico].[dbo].[citas]
        WHERE (@id_sucursal IS NULL OR [id_sucursal] = @id_sucursal)
          AND (@id_empresa  IS NULL OR [id_empresa]  = @id_empresa)
    `, { id_sucursal: id_sucursal ? Number(id_sucursal) : null, id_empresa: id_empresa ? Number(id_empresa) : null });

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
    const body: ICita = await req.json();

    const {
      id_cita,
      id_paciente,
      id_podologo,
      fecha_inicio,
      fecha_fin,
      estado,
      motivo_cancelacion,
      created_at,
      deleted_at,
      id_sucursal,
      id_empresa,
    } = body;

    const commonParams = {
      id_paciente,
      id_podologo,
      fecha_inicio,
      fecha_fin,
      estado,
      motivo_cancelacion,
      created_at,
      deleted_at,
      id_sucursal,
      id_empresa,
    };

    let result;

    if (id_cita === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[citas]
          ([id_cita],[id_paciente],[id_podologo],[fecha_inicio],[fecha_fin],
           [estado],[motivo_cancelacion],[created_at],[deleted_at],[id_sucursal],[id_empresa])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_cita]),0)+1 FROM [CentroPodologico].[dbo].[citas]),
          @id_paciente,@id_podologo,@fecha_inicio,@fecha_fin,
          @estado,@motivo_cancelacion,@created_at,@deleted_at,@id_sucursal,@id_empresa
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[citas] SET
          [id_paciente]        = @id_paciente,
          [id_podologo]        = @id_podologo,
          [fecha_inicio]       = @fecha_inicio,
          [fecha_fin]          = @fecha_fin,
          [estado]             = @estado,
          [motivo_cancelacion] = @motivo_cancelacion,
          [created_at]         = @created_at,
          [deleted_at]         = @deleted_at,
          [id_sucursal]        = @id_sucursal,
          [id_empresa]         = @id_empresa
        OUTPUT INSERTED.*
        WHERE [id_cita] = @id_cita
      `, { id_cita, ...commonParams });
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
