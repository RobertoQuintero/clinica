import db from "@/database/connection";
import { ITratamiento } from "@/interfaces/tratamiento";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const resp = await db.query(`
      SELECT [id_tratamiento]
            ,[id_paciente]
            ,[descripcion]
            ,[total_sesiones]
            ,[sesiones_realizadas]
            ,[estado]
            ,[created_at]
            ,[deleted_at]
            ,[status]
        FROM [CentroPodologico].[dbo].[tratamientos]
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
    const body: ITratamiento = await req.json();

    const {
      id_tratamiento,
      id_paciente,
      descripcion,
      total_sesiones,
      sesiones_realizadas,
      estado,
      created_at,
      deleted_at,
      status,
    } = body;

    const commonParams = {
      id_paciente,
      descripcion,
      total_sesiones,
      sesiones_realizadas,
      estado,
      created_at,
      deleted_at,
      status,
    };

    let result;

    if (id_tratamiento === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[tratamientos]
          ([id_tratamiento],[id_paciente],[descripcion],[total_sesiones],
           [sesiones_realizadas],[estado],[created_at],[deleted_at],[status])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_tratamiento]),0)+1 FROM [CentroPodologico].[dbo].[tratamientos]),
          @id_paciente,@descripcion,@total_sesiones,
          @sesiones_realizadas,@estado,@created_at,@deleted_at,@status
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[tratamientos] SET
          [id_paciente]         = @id_paciente,
          [descripcion]         = @descripcion,
          [total_sesiones]      = @total_sesiones,
          [sesiones_realizadas] = @sesiones_realizadas,
          [estado]              = @estado,
          [created_at]          = @created_at,
          [deleted_at]          = @deleted_at,
          [status]              = @status
        OUTPUT INSERTED.*
        WHERE [id_tratamiento] = @id_tratamiento
      `, { id_tratamiento, ...commonParams });
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
