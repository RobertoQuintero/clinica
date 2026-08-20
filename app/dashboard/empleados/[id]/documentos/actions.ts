"use server";

import db from "@/database/connection";
import { IAuthUser } from "@/interfaces/auth";
import {
  IDocumentType,
  IEmployeeDocument,
  IEmployeeDocumentSlot,
  EmployeeDocumentInput,
} from "@/interfaces/employee_document";
import { getEmployeeById } from "@/app/dashboard/empleados/actions";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

async function getActiveUser(): Promise<IAuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) throw new Error("No autenticado");
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as IAuthUser;
}

/** Catálogo completo + documentos activos de un empleado, listos para armar los slots de la pantalla. */
export async function getEmployeeDocuments(
  id_empleado: number
): Promise<{ slots: IEmployeeDocumentSlot[]; completados: number; total: number }> {
  const employee = await getEmployeeById(id_empleado);
  if (!employee) return { slots: [], completados: 0, total: 0 };

  const [types, documents] = await Promise.all([
    db.queryParams(
      `SELECT [id_tipo_documento], [nombre], [icono], [obligatorio], [orden]
         FROM [CentroPodologico].[RH].[tipos_documento]
        WHERE [status] = 1
        ORDER BY [orden]`,
      {}
    ) as Promise<IDocumentType[]>,
    db.queryParams(
      `SELECT d.[id_empleado_documento],
              d.[id_empleado],
              d.[id_tipo_documento],
              d.[nombre_personalizado],
              d.[url],
              d.[mime_type],
              d.[size_bytes],
              u.[nombre] AS nombre_usuario_carga,
              CONVERT(varchar(19), d.[created_at], 120) AS created_at
         FROM [CentroPodologico].[RH].[empleado_documentos] d
         LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.[id_user] = d.[id_usuario_carga]
        WHERE d.[id_empleado] = @id_empleado
          AND d.[status] = 1
        ORDER BY d.[created_at]`,
      { id_empleado }
    ) as Promise<IEmployeeDocument[]>,
  ]);

  const catalogSlots: IEmployeeDocumentSlot[] = types.map((tipo) => ({
    tipo,
    documento:
      documents.find((documento) => documento.id_tipo_documento === tipo.id_tipo_documento) ?? null,
  }));

  const freeDocumentSlots: IEmployeeDocumentSlot[] = documents
    .filter((documento) => documento.id_tipo_documento === null)
    .map((documento) => ({ tipo: null, documento }));

  const requiredTypes = types.filter((tipo) => tipo.obligatorio);
  const completados = catalogSlots.filter(
    (slot) => slot.tipo?.obligatorio && slot.documento !== null
  ).length;

  return {
    slots: [...catalogSlots, ...freeDocumentSlots],
    completados,
    total: requiredTypes.length,
  };
}

/** Registra un archivo ya subido a Cloudinary. Reemplaza el activo del mismo tipo, si existe. */
export async function saveEmployeeDocument(
  input: EmployeeDocumentInput
): Promise<ActionResult<number>> {
  try {
    const employee = await getEmployeeById(input.id_empleado);
    if (!employee) return { ok: false, message: "El empleado no existe o no pertenece a tu sucursal" };

    if (!ALLOWED_MIME_TYPES.includes(input.mime_type)) {
      return { ok: false, message: "Formato de archivo no permitido. Solo se aceptan PDF, JPG y PNG" };
    }
    if (input.size_bytes > MAX_SIZE_BYTES) {
      return { ok: false, message: "El archivo supera el tamaño máximo de 5 MB" };
    }
    if (input.id_tipo_documento === null && !(input.nombre_personalizado ?? "").trim()) {
      return { ok: false, message: "Debes indicar un nombre para el documento" };
    }

    const { id_user } = await getActiveUser();
    const created_at = buildDate(new Date());

    const insertedId = await db.transaction(async (tx) => {
      if (input.id_tipo_documento !== null) {
        await tx.queryParams(
          `UPDATE [CentroPodologico].[RH].[empleado_documentos]
              SET [status] = 0
            WHERE [id_empleado] = @id_empleado
              AND [id_tipo_documento] = @id_tipo_documento
              AND [status] = 1`,
          { id_empleado: input.id_empleado, id_tipo_documento: input.id_tipo_documento }
        );
      }

      const inserted = await tx.queryParams(
        `INSERT INTO [CentroPodologico].[RH].[empleado_documentos]
           ([id_empleado],[id_tipo_documento],[nombre_personalizado],[url],[mime_type],[size_bytes],
            [id_usuario_carga],[status],[created_at])
         OUTPUT INSERTED.[id_empleado_documento]
         VALUES
           (@id_empleado,@id_tipo_documento,@nombre_personalizado,@url,@mime_type,@size_bytes,
            @id_usuario_carga,1,@created_at)`,
        {
          id_empleado: input.id_empleado,
          id_tipo_documento: input.id_tipo_documento,
          nombre_personalizado: input.nombre_personalizado,
          url: input.url,
          mime_type: input.mime_type,
          size_bytes: input.size_bytes,
          id_usuario_carga: id_user,
          created_at,
        }
      );

      return (inserted[0] as { id_empleado_documento: number }).id_empleado_documento;
    });

    revalidatePath(`/dashboard/empleados/${input.id_empleado}/documentos`);
    return { ok: true, data: insertedId };
  } catch {
    return { ok: false, message: "Error al guardar el documento" };
  }
}
