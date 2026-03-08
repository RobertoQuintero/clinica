import db from "@/database/connection";
import { IServicioOpcion } from "@/interfaces/servicio_opcion";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const resp = await db.query(`
      SELECT [id_servicio_opcion]
            ,[id_servicio]
            ,[descripcion]
            ,[precio]
            ,[id_sucursal]
            ,[status]
        FROM [CentroPodologico].[dbo].[servicio_opciones]
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
    const body: IServicioOpcion = await req.json();

    const {
      id_servicio_opcion,
      id_servicio,
      descripcion,
      precio,
      id_sucursal,
      status,
    } = body;

    const commonParams = {
      id_servicio,
      descripcion,
      precio,
      id_sucursal,
      status,
    };

    let result;

    if (id_servicio_opcion === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[servicio_opciones]
          ([id_servicio_opcion],[id_servicio],[descripcion],[precio],[id_sucursal],[status])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_servicio_opcion]),0)+1 FROM [CentroPodologico].[dbo].[servicio_opciones]),
          @id_servicio,@descripcion,@precio,@id_sucursal,@status
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[servicio_opciones] SET
          [id_servicio] = @id_servicio,
          [descripcion] = @descripcion,
          [precio]      = @precio,
          [id_sucursal] = @id_sucursal,
          [status]      = @status
        OUTPUT INSERTED.*
        WHERE [id_servicio_opcion] = @id_servicio_opcion
      `, { id_servicio_opcion, ...commonParams });
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
