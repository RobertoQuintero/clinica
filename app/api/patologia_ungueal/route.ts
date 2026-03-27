import db from "@/database/connection";
import { IPatologiaUngueal } from "@/interfaces/patologia_ungueal";
import { NextResponse } from "next/server";

export const GET = async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);
    const id_consulta = searchParams.get("id_consulta");

    const resp = id_consulta
      ? await db.queryParams(
          `SELECT [id_patologia],[id_consulta],[anoniquia],[microniquia],[onicolisis],
                  [onicauxis],[hematoma_subungueal],[onicofosis],[paquioniquia],[onicomicosis]
             FROM [CentroPodologico].[dbo].[patologia_ungueal]
            WHERE [id_consulta] = @id_consulta`,
          { id_consulta: Number(id_consulta) }
        )
      : await db.query(
          `SELECT [id_patologia],[id_consulta],[anoniquia],[microniquia],[onicolisis],
                  [onicauxis],[hematoma_subungueal],[onicofosis],[paquioniquia],[onicomicosis]
             FROM [CentroPodologico].[dbo].[patologia_ungueal]`
        );

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
    const body: IPatologiaUngueal = await req.json();

    const {
      id_patologia,
      id_consulta,
      anoniquia,
      microniquia,
      onicolisis,
      onicauxis,
      hematoma_subungueal,
      onicofosis,
      paquioniquia,
      onicomicosis,
    } = body;

    const commonParams = {
      id_consulta,
      anoniquia,
      microniquia,
      onicolisis,
      onicauxis,
      hematoma_subungueal,
      onicofosis,
      paquioniquia,
      onicomicosis,
    };

    let result;

    if (id_patologia === 0) {
      result = await db.queryParams(`
        INSERT INTO [CentroPodologico].[dbo].[patologia_ungueal]
          ([id_patologia],[id_consulta],[anoniquia],[microniquia],[onicolisis],
           [onicauxis],[hematoma_subungueal],[onicofosis],[paquioniquia],[onicomicosis])
        OUTPUT INSERTED.*
        VALUES (
          (SELECT ISNULL(MAX([id_patologia]),0)+1 FROM [CentroPodologico].[dbo].[patologia_ungueal]),
          @id_consulta,@anoniquia,@microniquia,@onicolisis,
          @onicauxis,@hematoma_subungueal,@onicofosis,@paquioniquia,@onicomicosis
        )
      `, commonParams);
    } else {
      result = await db.queryParams(`
        UPDATE [CentroPodologico].[dbo].[patologia_ungueal] SET
          [id_consulta]         = @id_consulta,
          [anoniquia]           = @anoniquia,
          [microniquia]         = @microniquia,
          [onicolisis]          = @onicolisis,
          [onicauxis]           = @onicauxis,
          [hematoma_subungueal] = @hematoma_subungueal,
          [onicofosis]          = @onicofosis,
          [paquioniquia]        = @paquioniquia,
          [onicomicosis]        = @onicomicosis
        OUTPUT INSERTED.*
        WHERE [id_patologia] = @id_patologia
      `, { id_patologia, ...commonParams });
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
