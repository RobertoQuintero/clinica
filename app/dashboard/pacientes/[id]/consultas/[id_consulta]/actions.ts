"use server";

import db from "@/database/connection";
import { IArchivo } from "@/interfaces/archivos";
import { IConsulta } from "@/interfaces/consulta";
import { IConsultaProducto } from "@/interfaces/consulta_producto";
import { IConsultaServicio } from "@/interfaces/consulta_servicio";
import { IPaciente } from "@/interfaces/paciente";
import { IPago } from "@/interfaces/pago";
import { IPatologiaUngueal } from "@/interfaces/patologia_ungueal";
import { IServicio } from "@/interfaces/servicio";
import { IServicioOpcion } from "@/interfaces/servicio_opcion";
import { IValoracionPiel } from "@/interfaces/valoracion_piel";
import { buildDate } from "@/utils/date_helpper";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

// ─── types ────────────────────────────────────────────────────────────────────

export type ConsultaProductoExtended = IConsultaProducto & { nombre_producto?: string };

export interface ConsultaData {
  consulta:   IConsulta | null;
  paciente:   IPaciente | null;
  valoracion: IValoracionPiel | null;
  patologia:  IPatologiaUngueal | null;
  archivos:   IArchivo[];
  productos:  ConsultaProductoExtended[];
  pagos:      IPago[];
}

type ActionResult<T> = { ok: true; data: T } | { ok: false; data: string };

// ─── helpers ──────────────────────────────────────────────────────────────────

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

async function getIdEmpresa(): Promise<number> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return 0;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const user = payload as { id_empresa?: number };
    return user.id_empresa ?? 0;
  } catch {
    return 0;
  }
}

// ─── fetch all data ───────────────────────────────────────────────────────────

export async function getConsultaData(
  id_consulta: number,
  id_paciente: number,
): Promise<ConsultaData> {
  const [cRows, vRows, patRows, aRows, pRows, pgRows, pacRows] = await Promise.all([
    db.queryParams(
      `SELECT [id_consulta],[id_paciente],[id_podologo]
              ,CONVERT(varchar(19), [fecha], 120)      AS fecha
              ,[diagnostico],[tratamiento_aplicado],[observaciones]
              ,CONVERT(varchar(19), [created_at], 120) AS created_at
              ,[deleted_at],[costo_total],[id_sucursal],[id_empresa]
         FROM [CentroPodologico].[dbo].[consultas]
        WHERE [id_consulta] = @id_consulta AND [deleted_at] IS NULL`,
      { id_consulta },
    ),
    db.queryParams(
      `SELECT [id_valoracion_piel],[id_consulta]
              ,CONVERT(varchar(10), [fecha_valoracion], 120) AS fecha_valoracion
              ,[edema],[dermatomicosis],[pie_atleta],[bromhidrosis]
              ,[hiperdrosis],[anhidrosis],[hiperqueratosis]
              ,[helomas],[verrugas],[observaciones],[status]
              ,CONVERT(varchar(19), [created_at], 120) AS created_at
         FROM [CentroPodologico].[dbo].[valoracion_piel]
        WHERE [id_consulta] = @id_consulta`,
      { id_consulta },
    ),
    db.queryParams(
      `SELECT [id_patologia],[id_consulta],[anoniquia],[microniquia],[onicolisis],
              [onicauxis],[hematoma_subungueal],[onicofosis],[paquioniquia],[onicomicosis]
         FROM [CentroPodologico].[dbo].[patologia_ungueal]
        WHERE [id_consulta] = @id_consulta`,
      { id_consulta },
    ),
    db.queryParams(
      `SELECT [id_archivo],[id_consulta],[ruta],[tipo]
              ,CONVERT(varchar(19), [created_at], 120) AS created_at
              ,[categoria]
         FROM [CentroPodologico].[dbo].[archivos]
        WHERE [id_consulta] = @id_consulta
        ORDER BY [id_archivo] DESC`,
      { id_consulta },
    ),
    db.queryParams(
      `SELECT cp.[id_consulta_producto],cp.[id_consulta],cp.[id_producto]
              ,p.[nombre] AS nombre_producto
              ,cp.[precio],cp.[cantidad],cp.[status]
              ,CONVERT(varchar(19), cp.[created_at], 120) AS created_at
         FROM [CentroPodologico].[dbo].[consulta_productos] cp
         LEFT JOIN [CentroPodologico].[dbo].[productos] p ON p.[id_producto] = cp.[id_producto]
        WHERE cp.[id_consulta] = @id_consulta`,
      { id_consulta },
    ),
    db.queryParams(
      `SELECT [id_pago],[id_consulta],[monto],[metodo_pago]
              ,CONVERT(varchar(10), [fecha_pago], 120) AS fecha_pago
              ,[referencia]
              ,CONVERT(varchar(19), [created_at], 120) AS created_at
              ,[id_empresa]
         FROM [CentroPodologico].[dbo].[pagos]
        WHERE [id_consulta] = @id_consulta
        ORDER BY [id_pago] DESC`,
      { id_consulta },
    ),
    db.queryParams(
      `SELECT [id_paciente],[nombre],[telefono]
              ,CONVERT(varchar(10), [fecha_nacimiento], 120) AS fecha_nacimiento
              ,[direccion],[observaciones_generales],[created_at],[updated_at],[deleted_at]
              ,[apellido_paterno],[apellido_materno],[sexo],[whatsapp],[ciudad_preferida]
              ,[contacto_emergencia_nombre],[contacto_emergencia_whatsapp]
              ,[id_sucursal],[id_empresa]
         FROM [CentroPodologico].[dbo].[pacientes]
        WHERE [id_paciente] = @id_paciente`,
      { id_paciente },
    ),
  ]);

  return {
    consulta:   (cRows[0]   as IConsulta)              ?? null,
    valoracion: (vRows[0]   as IValoracionPiel)         ?? null,
    patologia:  (patRows[0] as IPatologiaUngueal)       ?? null,
    archivos:   (aRows      as IArchivo[])              ?? [],
    productos:  (pRows      as ConsultaProductoExtended[]) ?? [],
    pagos:      (pgRows     as IPago[])                 ?? [],
    paciente:   (pacRows[0] as IPaciente)               ?? null,
  };
}

// ─── valoración de piel ───────────────────────────────────────────────────────

export async function saveValoracion(
  form: IValoracionPiel,
): Promise<ActionResult<IValoracionPiel>> {
  try {
    const {
      id_valoracion_piel, id_consulta,
      fecha_valoracion, edema, dermatomicosis, pie_atleta, bromhidrosis,
      hiperdrosis, anhidrosis, hiperqueratosis, helomas, verrugas,
      observaciones, status,
    } = form;

    const created_at = form.created_at || buildDate(new Date());

    const commonParams = {
      id_consulta, fecha_valoracion, edema, dermatomicosis, pie_atleta,
      bromhidrosis, hiperdrosis, anhidrosis, hiperqueratosis, helomas,
      verrugas, observaciones, status, created_at,
    };

    let result;
    if (id_valoracion_piel === 0) {
      result = await db.queryParams(
        `INSERT INTO [CentroPodologico].[dbo].[valoracion_piel]
           ([id_valoracion_piel],[id_consulta],[fecha_valoracion],[edema],[dermatomicosis],
            [pie_atleta],[bromhidrosis],[hiperdrosis],[anhidrosis],[hiperqueratosis],
            [helomas],[verrugas],[observaciones],[status],[created_at])
         OUTPUT INSERTED.*
         VALUES (
           (SELECT ISNULL(MAX([id_valoracion_piel]),0)+1 FROM [CentroPodologico].[dbo].[valoracion_piel]),
           @id_consulta,@fecha_valoracion,@edema,@dermatomicosis,
           @pie_atleta,@bromhidrosis,@hiperdrosis,@anhidrosis,@hiperqueratosis,
           @helomas,@verrugas,@observaciones,@status,@created_at
         )`,
        commonParams,
      );
    } else {
      result = await db.queryParams(
        `UPDATE [CentroPodologico].[dbo].[valoracion_piel] SET
           [id_consulta]      = @id_consulta,
           [fecha_valoracion] = @fecha_valoracion,
           [edema]            = @edema,
           [dermatomicosis]   = @dermatomicosis,
           [pie_atleta]       = @pie_atleta,
           [bromhidrosis]     = @bromhidrosis,
           [hiperdrosis]      = @hiperdrosis,
           [anhidrosis]       = @anhidrosis,
           [hiperqueratosis]  = @hiperqueratosis,
           [helomas]          = @helomas,
           [verrugas]         = @verrugas,
           [observaciones]    = @observaciones,
           [status]           = @status,
           [created_at]       = @created_at
         OUTPUT INSERTED.*
         WHERE [id_valoracion_piel] = @id_valoracion_piel`,
        { id_valoracion_piel, ...commonParams },
      );
    }

    return { ok: true, data: result?.[0] as IValoracionPiel };
  } catch (err) {
    console.error(err);
    return { ok: false, data: "Error al guardar la valoración" };
  }
}

// ─── patología ungueal ────────────────────────────────────────────────────────

export async function savePatologia(
  form: IPatologiaUngueal,
): Promise<ActionResult<IPatologiaUngueal>> {
  try {
    const {
      id_patologia, id_consulta, anoniquia, microniquia, onicolisis,
      onicauxis, hematoma_subungueal, onicofosis, paquioniquia, onicomicosis,
    } = form;

    const commonParams = {
      id_consulta, anoniquia, microniquia, onicolisis,
      onicauxis, hematoma_subungueal, onicofosis, paquioniquia, onicomicosis,
    };

    let result;
    if (id_patologia === 0) {
      result = await db.queryParams(
        `INSERT INTO [CentroPodologico].[dbo].[patologia_ungueal]
           ([id_patologia],[id_consulta],[anoniquia],[microniquia],[onicolisis],
            [onicauxis],[hematoma_subungueal],[onicofosis],[paquioniquia],[onicomicosis])
         OUTPUT INSERTED.*
         VALUES (
           (SELECT ISNULL(MAX([id_patologia]),0)+1 FROM [CentroPodologico].[dbo].[patologia_ungueal]),
           @id_consulta,@anoniquia,@microniquia,@onicolisis,
           @onicauxis,@hematoma_subungueal,@onicofosis,@paquioniquia,@onicomicosis
         )`,
        commonParams,
      );
    } else {
      result = await db.queryParams(
        `UPDATE [CentroPodologico].[dbo].[patologia_ungueal] SET
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
         WHERE [id_patologia] = @id_patologia`,
        { id_patologia, ...commonParams },
      );
    }

    return { ok: true, data: result?.[0] as IPatologiaUngueal };
  } catch (err) {
    console.error(err);
    return { ok: false, data: "Error al guardar la patología" };
  }
}

// ─── pagos ────────────────────────────────────────────────────────────────────

export async function savePago(
  form: Omit<IPago, "id_pago" | "created_at" | "id_empresa">,
): Promise<ActionResult<IPago>> {
  try {
    const id_empresa = await getIdEmpresa();
    const created_at = buildDate(new Date());

    const result = await db.queryParams(
      `INSERT INTO [CentroPodologico].[dbo].[pagos]
         ([id_pago],[id_consulta],[monto],[metodo_pago],[fecha_pago],[referencia],[created_at],[id_empresa])
       OUTPUT INSERTED.*
       VALUES (
         (SELECT ISNULL(MAX([id_pago]),0)+1 FROM [CentroPodologico].[dbo].[pagos]),
         @id_consulta,@monto,@metodo_pago,@fecha_pago,@referencia,@created_at,@id_empresa
       )`,
      {
        id_consulta:  form.id_consulta,
        monto:        form.monto,
        metodo_pago:  form.metodo_pago,
        fecha_pago:   form.fecha_pago,
        referencia:   form.referencia,
        created_at,
        id_empresa,
      },
    );

    return { ok: true, data: result?.[0] as IPago };
  } catch (err) {
    console.error(err);
    return { ok: false, data: "Error al registrar el pago" };
  }
}

// ─── servicios con opciones ───────────────────────────────────────────────────

export interface ServicioConOpciones extends IServicio {
  opciones: IServicioOpcion[];
}

export async function getServiciosTabData(id_consulta: number): Promise<{
  servicios:         ServicioConOpciones[];
  consultaServicios: IConsultaServicio[];
}> {
  const id_empresa = await getIdEmpresa();

  const [rows, csRows] = await Promise.all([
    db.queryParams(
      `SELECT s.[id_servicio], s.[nombre], s.[status],
              CONVERT(varchar(19), s.[cretated_at], 120) AS cretated_at,
              s.[id_empresa],
              so.[id_servicio_opcion], so.[descripcion], so.[precio], so.[id_sucursal]
         FROM [CentroPodologico].[dbo].[servicios] s
         LEFT JOIN [CentroPodologico].[dbo].[servicio_opciones] so
                ON so.[id_servicio] = s.[id_servicio] AND so.[status] = 1
        WHERE s.[status] = 1
          AND s.[id_empresa] = @id_empresa
        ORDER BY s.[id_servicio], so.[id_servicio_opcion]`,
      { id_empresa },
    ),
    db.queryParams(
      `SELECT [id_consulta_servicio],[id_consulta],[id_servicio_opcion],[precio_aplicado]
         FROM [CentroPodologico].[dbo].[consulta_servicios]
        WHERE [id_consulta] = @id_consulta`,
      { id_consulta },
    ),
  ]);

  type JoinRow = IServicio & {
    id_servicio_opcion: number | null;
    descripcion:        string | null;
    precio:             number | null;
    id_sucursal:        number | null;
  };

  const servicioMap = new Map<number, ServicioConOpciones>();
  for (const r of rows as JoinRow[]) {
    if (!servicioMap.has(r.id_servicio)) {
      servicioMap.set(r.id_servicio, {
        id_servicio: r.id_servicio,
        nombre:      r.nombre,
        status:      r.status,
        cretated_at: r.cretated_at,
        id_empresa:  r.id_empresa,
        opciones:    [],
      });
    }
    if (r.id_servicio_opcion !== null) {
      servicioMap.get(r.id_servicio)!.opciones.push({
        id_servicio_opcion: r.id_servicio_opcion,
        id_servicio:        r.id_servicio,
        descripcion:        r.descripcion!,
        precio:             r.precio!,
        id_sucursal:        r.id_sucursal ?? 0,
        status:             true,
      });
    }
  }

  return {
    servicios:         Array.from(servicioMap.values()),
    consultaServicios: csRows as IConsultaServicio[],
  };
}

export async function selectServicioOpcion(
  id_consulta:      number,
  id_servicio:      number,
  id_servicio_opcion: number,
  precio_aplicado:  number,
): Promise<ActionResult<IConsultaServicio | null>> {
  try {
    // Remove previous selection for this service in this consultation
    await db.queryParams(
      `DELETE cs
         FROM [CentroPodologico].[dbo].[consulta_servicios] cs
         JOIN [CentroPodologico].[dbo].[servicio_opciones] so
           ON so.[id_servicio_opcion] = cs.[id_servicio_opcion]
        WHERE cs.[id_consulta] = @id_consulta
          AND so.[id_servicio] = @id_servicio`,
      { id_consulta, id_servicio },
    );

    if (id_servicio_opcion === 0) {
      return { ok: true, data: null };
    }

    const result = await db.queryParams(
      `INSERT INTO [CentroPodologico].[dbo].[consulta_servicios]
         ([id_consulta_servicio],[id_consulta],[id_servicio_opcion],[precio_aplicado])
       OUTPUT INSERTED.*
       VALUES (
         (SELECT ISNULL(MAX([id_consulta_servicio]),0)+1 FROM [CentroPodologico].[dbo].[consulta_servicios]),
         @id_consulta,@id_servicio_opcion,@precio_aplicado
       )`,
      { id_consulta, id_servicio_opcion, precio_aplicado },
    );

    return { ok: true, data: result?.[0] as IConsultaServicio };
  } catch (err) {
    console.error(err);
    return { ok: false, data: "Error al guardar la selección de servicio" };
  }
}

// ─── archivos ─────────────────────────────────────────────────────────────────

export async function saveArchivo(
  archivo: Omit<IArchivo, "id_archivo">,
): Promise<ActionResult<IArchivo>> {
  try {
    const result = await db.queryParams(
      `INSERT INTO [CentroPodologico].[dbo].[archivos]
         ([id_archivo],[id_consulta],[ruta],[tipo],[created_at],[categoria])
       OUTPUT INSERTED.*
       VALUES (
         (SELECT ISNULL(MAX([id_archivo]),0)+1 FROM [CentroPodologico].[dbo].[archivos]),
         @id_consulta,@ruta,@tipo,@created_at,@categoria
       )`,
      {
        id_consulta: archivo.id_consulta,
        ruta:        archivo.ruta,
        tipo:        archivo.tipo,
        created_at:  archivo.created_at,
        categoria:   archivo.categoria,
      },
    );

    return { ok: true, data: result?.[0] as IArchivo };
  } catch (err) {
    console.error(err);
    return { ok: false, data: "Error al registrar el archivo" };
  }
}
