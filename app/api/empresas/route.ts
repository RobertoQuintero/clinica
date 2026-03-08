import db from "@/database/connection";
import { IEmpresa } from "@/interfaces/empresas";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const resp = await db.query(`
      SELECT [id_empresa]
            ,[nombre]
            ,[telefono]
            ,[email]
            ,[created_at]
            ,[status]
        FROM [CentroPodologico].[dbo].[empresas]
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
    const body: IEmpresa = await req.json();

    const {
      id_empresa,
      nombre,
      telefono,
      email,
      created_at,
      status,
    } = body;

    const commonParams = {
      nombre,
      telefono,
      email,
      created_at,
      status,
    };

    let result;

    if (id_empresa === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[empresas]
          ([id_empresa],[nombre],[telefono],[email],[created_at],[status])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_empresa]),0)+1 FROM [CentroPodologico].[dbo].[empresas]),
          @nombre,@telefono,@email,@created_at,@status
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[empresas] SET
          [nombre]     = @nombre,
          [telefono]   = @telefono,
          [email]      = @email,
          [created_at] = @created_at,
          [status]     = @status
        OUTPUT INSERTED.*
        WHERE [id_empresa] = @id_empresa
      `, { id_empresa, ...commonParams });
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
