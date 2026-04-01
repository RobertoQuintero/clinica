"use server";

import db from "@/database/connection";
import { IAntecedenteMedico } from "@/interfaces/antecedentes";
import { IPaciente } from "@/interfaces/paciente";
import { toDBString } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";

export async function getPacienteById(id_paciente: number): Promise<IPaciente | null> {
  const data = await db.queryParams(
    `SELECT [id_paciente],
            [nombre],
            [telefono],
            CONVERT(varchar(10), [fecha_nacimiento], 120) AS fecha_nacimiento,
            [direccion],
            [observaciones_generales],
            CONVERT(varchar(19), [created_at], 120) AS created_at,
            CONVERT(varchar(19), [updated_at], 120) AS updated_at,
            CONVERT(varchar(19), [deleted_at], 120) AS deleted_at,
            [apellido_paterno],
            [apellido_materno],
            [sexo],
            [whatsapp],
            [ciudad_preferida],
            [contacto_emergencia_nombre],
            [contacto_emergencia_whatsapp],
            [id_sucursal],
            [id_empresa]
       FROM [CentroPodologico].[dbo].[pacientes]
      WHERE [id_paciente] = @id_paciente`,
    { id_paciente }
  );
  const rows = data as IPaciente[];
  return rows.length ? rows[0] : null;
}

export async function getAntecedentes(id_paciente: number): Promise<IAntecedenteMedico[]> {
  const data = await db.queryParams(
    `SELECT [id_antecedente_medico],
            [id_paciente],
            CONVERT(varchar(10), [fecha_registro], 120) AS fecha_registro,
            [alergia_anestesia],
            [alergia_antibioticos],
            [alergia_sulfas],
            [alergia_latex],
            [alergia_ninguna],
            [diabetico],
            [hipertenso],
            [hipotiroidismo],
            [cancer],
            [embarazada],
            [lactando],
            [fracturas],
            [antecedentes_dermatologicos],
            [medicamentos_actuales],
            [tipo_sangre],
            [otros]
       FROM [CentroPodologico].[dbo].[antecedentes_medicos]
      WHERE [id_paciente] = @id_paciente`,
    { id_paciente }
  );
  return data as IAntecedenteMedico[];
}

export async function saveAntecedente(
  form: IAntecedenteMedico
): Promise<{ ok: boolean; message?: string }> {
  try {
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
    } = form;

    const commonParams = {
      id_paciente,
      fecha_registro: toDBString(String(fecha_registro ?? "")),
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

    if (id_antecedente_medico === 0) {
      await db.queryParams(
        `INSERT INTO [CentroPodologico].[dbo].[antecedentes_medicos]
           ([id_antecedente_medico],[id_paciente],[fecha_registro],
            [alergia_anestesia],[alergia_antibioticos],[alergia_sulfas],
            [alergia_latex],[alergia_ninguna],[diabetico],[hipertenso],
            [hipotiroidismo],[cancer],[embarazada],[lactando],[fracturas],
            [antecedentes_dermatologicos],[medicamentos_actuales],[tipo_sangre],[otros])
         VALUES (
           (SELECT ISNULL(MAX([id_antecedente_medico]),0)+1 FROM [CentroPodologico].[dbo].[antecedentes_medicos]),
           @id_paciente,@fecha_registro,@alergia_anestesia,@alergia_antibioticos,
           @alergia_sulfas,@alergia_latex,@alergia_ninguna,@diabetico,@hipertenso,
           @hipotiroidismo,@cancer,@embarazada,@lactando,@fracturas,
           @antecedentes_dermatologicos,@medicamentos_actuales,@tipo_sangre,@otros
         )`,
        commonParams
      );
    } else {
      await db.queryParams(
        `UPDATE [CentroPodologico].[dbo].[antecedentes_medicos] SET
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
         WHERE [id_antecedente_medico]   = @id_antecedente_medico`,
        { id_antecedente_medico, ...commonParams }
      );
    }

    revalidatePath(`/dashboard/pacientes/${id_paciente}/expediente_medico`);
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al guardar el antecedente médico" };
  }
}
