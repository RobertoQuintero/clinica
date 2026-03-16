import db from "@/database/connection";
import { IPaciente } from "@/interfaces/paciente";
import { toDBString } from "@/utils/date_helpper";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);
    const id_sucursal = searchParams.get("id_sucursal");
    const id_empresa  = searchParams.get("id_empresa");
    const id_paciente = searchParams.get("id_paciente");

    const resp = await db.queryParams(`
      SELECT [id_paciente]
            ,[nombre]
            ,[telefono]
            ,CONVERT(varchar(10), [fecha_nacimiento], 120) AS fecha_nacimiento
            ,[direccion]
            ,[observaciones_generales]
            ,[created_at]
            ,[updated_at]
            ,[deleted_at]
            ,[apellido_paterno]
            ,[apellido_materno]
            ,[sexo]
            ,[whatsapp]
            ,[ciudad_preferida]
            ,[contacto_emergencia_nombre]
            ,[contacto_emergencia_whatsapp]
            ,[id_sucursal]
            ,[id_empresa]
        FROM [CentroPodologico].[dbo].[pacientes]
        WHERE (@id_sucursal IS NULL OR [id_sucursal] = @id_sucursal)
          AND (@id_empresa  IS NULL OR [id_empresa]  = @id_empresa)
          AND (@id_paciente IS NULL OR [id_paciente] = @id_paciente)
    `, { id_sucursal: id_sucursal ? Number(id_sucursal) : null, id_empresa: id_empresa ? Number(id_empresa) : null, id_paciente: id_paciente ? Number(id_paciente) : null });

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
    const body: IPaciente = await req.json();

    const {
      id_paciente,
      nombre,
      telefono,
      fecha_nacimiento,
      direccion,
      observaciones_generales,
      created_at,
      updated_at,
      deleted_at,
      apellido_paterno,
      apellido_materno,
      sexo,
      whatsapp,
      ciudad_preferida,
      contacto_emergencia_nombre,
      contacto_emergencia_whatsapp,
      id_sucursal,
      id_empresa,
    } = body;

    const toDate = (val: Date | string | null | undefined) =>
      val ? new Date(val) : null;

    const commonParams = {
      nombre,
      telefono,
      fecha_nacimiento: toDBString(String(fecha_nacimiento ?? '')),
      direccion,
      observaciones_generales,
      created_at:  toDate(created_at),
      updated_at:  toDate(updated_at),
      deleted_at:  toDate(deleted_at),
      apellido_paterno,
      apellido_materno,
      sexo,
      whatsapp,
      ciudad_preferida,
      contacto_emergencia_nombre,
      contacto_emergencia_whatsapp,
      id_sucursal,
      id_empresa,
    };
    

    let result;

    if (id_paciente === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[pacientes]
          ([id_paciente],[nombre],[telefono],[fecha_nacimiento],[direccion],
           [observaciones_generales],[created_at],[updated_at],[deleted_at],
           [apellido_paterno],[apellido_materno],[sexo],[whatsapp],[ciudad_preferida],
           [contacto_emergencia_nombre],[contacto_emergencia_whatsapp],[id_sucursal],[id_empresa])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_paciente]),0)+1 FROM [CentroPodologico].[dbo].[pacientes]),
          @nombre,@telefono,@fecha_nacimiento,@direccion,
          @observaciones_generales,@created_at,@updated_at,@deleted_at,
          @apellido_paterno,@apellido_materno,@sexo,@whatsapp,@ciudad_preferida,
          @contacto_emergencia_nombre,@contacto_emergencia_whatsapp,@id_sucursal,@id_empresa
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[pacientes] SET
          [nombre]                       = @nombre,
          [telefono]                     = @telefono,
          [fecha_nacimiento]             = @fecha_nacimiento,
          [direccion]                    = @direccion,
          [observaciones_generales]      = @observaciones_generales,
          [created_at]                   = @created_at,
          [updated_at]                   = @updated_at,
          [deleted_at]                   = @deleted_at,
          [apellido_paterno]             = @apellido_paterno,
          [apellido_materno]             = @apellido_materno,
          [sexo]                         = @sexo,
          [whatsapp]                     = @whatsapp,
          [ciudad_preferida]             = @ciudad_preferida,
          [contacto_emergencia_nombre]   = @contacto_emergencia_nombre,
          [contacto_emergencia_whatsapp] = @contacto_emergencia_whatsapp,
          [id_sucursal]                  = @id_sucursal,
          [id_empresa]                   = @id_empresa
        OUTPUT INSERTED.*
        WHERE [id_paciente] = @id_paciente
      `, { id_paciente, ...commonParams });
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
