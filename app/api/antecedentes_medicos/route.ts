import db from "@/database/connection";
import { IAntecedenteMedico } from "@/interfaces/antecedentes";
import { NextResponse } from "next/server";

export const GET = async(req:Request) =>{
    
  try {
    const { searchParams } = new URL(req.url);
    const id_paciente = searchParams.get("id_paciente");

    const resp = id_paciente
      ? await db.queryParams(`
          SELECT [id_antecedente_medico]
        ,[id_paciente]
        ,CONVERT(varchar(10), [fecha_registro], 120) AS fecha_registro
        ,[alergia_anestesia]
        ,[alergia_antibioticos]
        ,[alergia_sulfas]
        ,[alergia_latex]
        ,[alergia_ninguna]
        ,[diabetico]
        ,[hipertenso]
        ,[hipotiroidismo]
        ,[cancer]
        ,[embarazada]
        ,[lactando]
        ,[fracturas]
        ,[antecedentes_dermatologicos]
        ,[medicamentos_actuales]
        ,[tipo_sangre]
        ,[otros]
        FROM [CentroPodologico].[dbo].[antecedentes_medicos]
        WHERE [id_paciente] = @id_paciente
        `, { id_paciente: Number(id_paciente) })
      : await db.query(`
          SELECT [id_antecedente_medico]
        ,[id_paciente]
        ,CONVERT(varchar(10), [fecha_registro], 120) AS fecha_registro
        ,[alergia_anestesia]
        ,[alergia_antibioticos]
        ,[alergia_sulfas]
        ,[alergia_latex]
        ,[alergia_ninguna]
        ,[diabetico]
        ,[hipertenso]
        ,[hipotiroidismo]
        ,[cancer]
        ,[embarazada]
        ,[lactando]
        ,[fracturas]
        ,[antecedentes_dermatologicos]
        ,[medicamentos_actuales]
        ,[tipo_sangre]
        ,[otros]
        FROM [CentroPodologico].[dbo].[antecedentes_medicos]
        `)


    return NextResponse.json({
      ok:true,
      data:resp
    })
  } catch (error) {
    console.log({error})
    return NextResponse.json({
      ok:false,
      data:'Error en el servidor al intentar conectar con la base de datos'
    },{
      status:500
    })
  }
};
export const POST = async (req: Request) => {
  try {
    const body: IAntecedenteMedico = await req.json();

    const {
      id_antecedente_medico,
      id_paciente,
      fecha_registro,
      alergia_anestesia,
      alergia_antibioticos,
      alergia_sulfas,
      alergia_latex,
      alergia_ninguna,
      diabetico,
      hipertenso,
      hipotiroidismo,
      cancer,
      embarazada,
      lactando,
      fracturas,
      antecedentes_dermatologicos,
      medicamentos_actuales,
      tipo_sangre,
      otros,
    } = body;

    const commonParams = {
      id_paciente,
      fecha_registro,
      alergia_anestesia,
      alergia_antibioticos,
      alergia_sulfas,
      alergia_latex,
      alergia_ninguna,
      diabetico,
      hipertenso,
      hipotiroidismo,
      cancer,
      embarazada,
      lactando,
      fracturas,
      antecedentes_dermatologicos,
      medicamentos_actuales,
      tipo_sangre,
      otros,
    };

    let result;

    if (id_antecedente_medico === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[antecedentes_medicos]
          ([id_antecedente_medico],[id_paciente],[fecha_registro],
           [alergia_anestesia],[alergia_antibioticos],[alergia_sulfas],
           [alergia_latex],[alergia_ninguna],[diabetico],[hipertenso],
           [hipotiroidismo],[cancer],[embarazada],[lactando],[fracturas],
           [antecedentes_dermatologicos],[medicamentos_actuales],[tipo_sangre],[otros])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_antecedente_medico]),0)+1 FROM [CentroPodologico].[dbo].[antecedentes_medicos]),
          @id_paciente,@fecha_registro,@alergia_anestesia,@alergia_antibioticos,
          @alergia_sulfas,@alergia_latex,@alergia_ninguna,@diabetico,@hipertenso,
          @hipotiroidismo,@cancer,@embarazada,@lactando,@fracturas,
          @antecedentes_dermatologicos,@medicamentos_actuales,@tipo_sangre,@otros
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[antecedentes_medicos] SET
          [id_paciente]                 = @id_paciente,
          [fecha_registro]              = @fecha_registro,
          [alergia_anestesia]           = @alergia_anestesia,
          [alergia_antibioticos]        = @alergia_antibioticos,
          [alergia_sulfas]              = @alergia_sulfas,
          [alergia_latex]               = @alergia_latex,
          [alergia_ninguna]             = @alergia_ninguna,
          [diabetico]                   = @diabetico,
          [hipertenso]                  = @hipertenso,
          [hipotiroidismo]              = @hipotiroidismo,
          [cancer]                      = @cancer,
          [embarazada]                  = @embarazada,
          [lactando]                    = @lactando,
          [fracturas]                   = @fracturas,
          [antecedentes_dermatologicos] = @antecedentes_dermatologicos,
          [medicamentos_actuales]       = @medicamentos_actuales,
          [tipo_sangre]                 = @tipo_sangre,
          [otros]                       = @otros
        OUTPUT INSERTED.*
        WHERE [id_antecedente_medico]   = @id_antecedente_medico
      `, { id_antecedente_medico, ...commonParams });
    }

    return NextResponse.json({ ok: true, data: result?.[0] ?? null });
  } catch (error) {
    console.log({ error });
    return NextResponse.json({
      ok: false,
      data: 'Error en el servidor al intentar conectar con la base de datos'
    }, { status: 500 });
  }
};