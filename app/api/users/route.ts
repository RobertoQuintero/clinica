import db from "@/database/connection";
import { IUser } from "@/interfaces/user";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export const GET = async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);
    const id_sucursal = searchParams.get("id_sucursal");
    const id_empresa  = searchParams.get("id_empresa");

    const resp = await db.queryParams(`
      SELECT [id_user]
            ,[nombre]
            ,[email]
            ,[telefono]
            ,[password_hash]
            ,[id_role]
            ,[status]
            ,[created_at]
            ,[updated_at]
            ,[deleted_at]
            ,[id_sucursal]
            ,[id_empresa]
        FROM [CentroPodologico].[dbo].[users]
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
    const body: IUser = await req.json();

    const {
      id_user,
      nombre,
      email,
      telefono,
      password_hash: rawPassword,
      id_role,
      status,
      created_at,
      updated_at,
      deleted_at,
      id_sucursal,
      id_empresa,
    } = body;

    let result;

    if (id_user === 0) {
      // Nuevo usuario: password obligatorio, siempre hashear
      if (!rawPassword) {
        return NextResponse.json(
          { ok: false, data: "La contraseña es requerida" },
          { status: 400 }
        );
      }
      const password_hash = await bcrypt.hash(rawPassword, 10);

      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[users]
          ([id_user],[nombre],[email],[telefono],[password_hash],[id_role],
           [status],[created_at],[updated_at],[deleted_at],[id_sucursal],[id_empresa])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_user]),0)+1 FROM [CentroPodologico].[dbo].[users]),
          @nombre,@email,@telefono,@password_hash,@id_role,
          @status,@created_at,@updated_at,@deleted_at,@id_sucursal,@id_empresa
        )
      `, {
        nombre, email, telefono, password_hash,
        id_role, status, created_at, updated_at, deleted_at, id_sucursal, id_empresa,
      });
    } else {
      // Edición: si viene password lo hasheamos; si no, conservar el hash existente
      let passwordClause = "";
      let passwordParam: Record<string, string> = {};

      if (rawPassword) {
        const password_hash = await bcrypt.hash(rawPassword, 10);
        passwordClause = "[password_hash] = @password_hash,";
        passwordParam  = { password_hash };
      }

      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[users] SET
          [nombre]        = @nombre,
          [email]         = @email,
          [telefono]      = @telefono,
          ${passwordClause}
          [id_role]       = @id_role,
          [status]        = @status,
          [created_at]    = @created_at,
          [updated_at]    = @updated_at,
          [deleted_at]    = @deleted_at,
          [id_sucursal]   = @id_sucursal,
          [id_empresa]    = @id_empresa
        OUTPUT INSERTED.*
        WHERE [id_user] = @id_user
      `, {
        id_user, nombre, email, telefono,
        ...passwordParam,
        id_role, status, created_at, updated_at, deleted_at, id_sucursal, id_empresa,
      });
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
