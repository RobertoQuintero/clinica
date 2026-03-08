import db from "@/database/connection";
import { IRole } from "@/interfaces/roles";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const resp = await db.query(`
      SELECT [id_role]
            ,[nombre]
            ,[created_at]
        FROM [CentroPodologico].[dbo].[roles]
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
    const body: IRole = await req.json();

    const {
      id_role,
      nombre,
      created_at,
    } = body;

    const commonParams = {
      nombre,
      created_at,
    };

    let result;

    if (id_role === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[roles]
          ([id_role],[nombre],[created_at])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_role]),0)+1 FROM [CentroPodologico].[dbo].[roles]),
          @nombre,@created_at
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[roles] SET
          [nombre]     = @nombre,
          [created_at] = @created_at
        OUTPUT INSERTED.*
        WHERE [id_role] = @id_role
      `, { id_role, ...commonParams });
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
