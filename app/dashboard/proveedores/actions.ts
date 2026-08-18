"use server";

import db from "@/database/connection";
import { ISupplier } from "@/interfaces/supplier";
import { ISupplierProduct } from "@/interfaces/supplier_product";
import { IAuthUser } from "@/interfaces/auth";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

async function getActiveUser(): Promise<IAuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) throw new Error("No autenticado");
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as IAuthUser;
}

export async function getSuppliers(): Promise<ISupplier[]> {
  const { id_empresa } = await getActiveUser();
  const data = await db.queryParams(
    `SELECT [id_proveedor],
            [id_empresa],
            [nombre_corto],
            [nombre_legal],
            [rfc],
            [codigo_postal],
            [direccion],
            [web],
            [telefono_principal],
            [id_phonecode_principal],
            [telefono_secundario],
            [whatsapp_principal],
            [id_whatsappcode_principal],
            [whatsapp_secundario],
            [email_principal],
            [email_secundario],
            [activo],
            [status],
            CONVERT(varchar(19), [created_at], 120) AS created_at
       FROM [CentroPodologico].[inventory].[proveedores]
      WHERE [status] = 1
        AND [id_empresa] = @id_empresa
      ORDER BY [nombre_corto]`,
    { id_empresa }
  );
  return data as ISupplier[];
}

export async function getSupplierById(
  id_proveedor: number
): Promise<ISupplier | null> {
  const { id_empresa } = await getActiveUser();
  const data = await db.queryParams(
    `SELECT [id_proveedor],
            [id_empresa],
            [nombre_corto],
            [nombre_legal],
            [rfc],
            [codigo_postal],
            [direccion],
            [web],
            [telefono_principal],
            [id_phonecode_principal],
            [telefono_secundario],
            [whatsapp_principal],
            [id_whatsappcode_principal],
            [whatsapp_secundario],
            [email_principal],
            [email_secundario],
            [activo],
            [status],
            CONVERT(varchar(19), [created_at], 120) AS created_at
       FROM [CentroPodologico].[inventory].[proveedores]
      WHERE [id_proveedor] = @id_proveedor
        AND [id_empresa]   = @id_empresa`,
    { id_proveedor, id_empresa }
  );
  const [supplier] = data as ISupplier[];
  return supplier ?? null;
}

export async function getSupplierProducts(
  id_proveedor: number
): Promise<ISupplierProduct[]> {
  const { id_empresa } = await getActiveUser();
  const data = await db.queryParams(
    `SELECT p.[id_product],
            p.[name],
            p.[product_code],
            c.[name] AS category_name,
            u.[name] AS unit_name,
            p.[price],
            CONVERT(varchar(10), lp.[last_purchase], 120) AS last_purchase
       FROM [CentroPodologico].[inventory].[Products] p
       LEFT JOIN [CentroPodologico].[inventory].[categories] c ON c.[id_category] = p.[id_category]
       LEFT JOIN [CentroPodologico].[inventory].[units_measurement] u ON u.[id_unit_measurement] = p.[id_unit_measurement]
       OUTER APPLY (
           SELECT MAX(k.[created_at]) AS last_purchase
             FROM [CentroPodologico].[inventory].[kardex] k
             JOIN [CentroPodologico].[inventory].[purchase_order_items] poi ON poi.[id_purchase_order_item] = k.[id_purchase_order_item]
             JOIN [CentroPodologico].[inventory].[purchase_orders] po ON po.[id_purchase_order] = poi.[id_purchase_order]
            WHERE k.[id_product] = p.[id_product]
              AND k.[id_movement] = 1
              AND po.[id_supplier] = p.[id_supplier]
       ) lp
      WHERE p.[id_supplier] = @id_proveedor
        AND p.[status] = 1
        AND p.[id_empresa] = @id_empresa
      ORDER BY p.[name]`,
    { id_proveedor, id_empresa }
  );
  return data as ISupplierProduct[];
}

export async function saveSupplier(
  form: Omit<ISupplier, "id_empresa" | "status" | "created_at">
): Promise<{ ok: boolean; message?: string }> {
  try {
    const {
      id_proveedor,
      nombre_corto,
      nombre_legal,
      rfc,
      codigo_postal,
      direccion,
      web,
      telefono_principal,
      id_phonecode_principal,
      telefono_secundario,
      whatsapp_principal,
      id_whatsappcode_principal,
      whatsapp_secundario,
      email_principal,
      email_secundario,
      activo,
    } = form;

    if (!nombre_corto || !nombre_corto.trim()) {
      return { ok: false, message: "El nombre corto es obligatorio" };
    }

    const { id_empresa } = await getActiveUser();

    const commonParams = {
      nombre_corto,
      nombre_legal,
      rfc,
      codigo_postal,
      direccion,
      web,
      telefono_principal,
      id_phonecode_principal: id_phonecode_principal ?? null,
      telefono_secundario,
      whatsapp_principal,
      id_whatsappcode_principal: id_whatsappcode_principal ?? null,
      whatsapp_secundario,
      email_principal,
      email_secundario,
      activo,
    };

    if (id_proveedor === 0) {
      await db.queryParams(
        `INSERT INTO [CentroPodologico].[inventory].[proveedores]
           ([id_proveedor],[id_empresa],[nombre_corto],[nombre_legal],[rfc],[codigo_postal],
            [direccion],[web],[telefono_principal],[id_phonecode_principal],[telefono_secundario],
            [whatsapp_principal],[id_whatsappcode_principal],[whatsapp_secundario],
            [email_principal],[email_secundario],[activo],[status],[created_at])
         VALUES (
           (SELECT ISNULL(MAX([id_proveedor]), 0) + 1 FROM [CentroPodologico].[inventory].[proveedores]),
           @id_empresa,@nombre_corto,@nombre_legal,@rfc,@codigo_postal,
           @direccion,@web,@telefono_principal,@id_phonecode_principal,@telefono_secundario,
           @whatsapp_principal,@id_whatsappcode_principal,@whatsapp_secundario,
           @email_principal,@email_secundario,@activo,1,@created_at
         )`,
        { ...commonParams, id_empresa, created_at: buildDate(new Date()) }
      );
    } else {
      await db.queryParams(
        `UPDATE [CentroPodologico].[inventory].[proveedores] SET
           [nombre_corto]              = @nombre_corto,
           [nombre_legal]              = @nombre_legal,
           [rfc]                       = @rfc,
           [codigo_postal]             = @codigo_postal,
           [direccion]                 = @direccion,
           [web]                       = @web,
           [telefono_principal]        = @telefono_principal,
           [id_phonecode_principal]    = @id_phonecode_principal,
           [telefono_secundario]       = @telefono_secundario,
           [whatsapp_principal]        = @whatsapp_principal,
           [id_whatsappcode_principal] = @id_whatsappcode_principal,
           [whatsapp_secundario]       = @whatsapp_secundario,
           [email_principal]           = @email_principal,
           [email_secundario]          = @email_secundario,
           [activo]                    = @activo
         WHERE [id_proveedor] = @id_proveedor
           AND [id_empresa]   = @id_empresa`,
        { id_proveedor, id_empresa, ...commonParams }
      );
    }

    revalidatePath("/dashboard/proveedores");
    revalidatePath(`/dashboard/proveedores/${id_proveedor}`);
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al guardar el proveedor" };
  }
}

export async function deleteSupplier(
  id_proveedor: number
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { id_empresa } = await getActiveUser();
    await db.queryParams(
      `UPDATE [CentroPodologico].[inventory].[proveedores]
          SET [status] = 0
        WHERE [id_proveedor] = @id_proveedor
          AND [id_empresa]   = @id_empresa`,
      { id_proveedor, id_empresa }
    );
    revalidatePath("/dashboard/proveedores");
    revalidatePath(`/dashboard/proveedores/${id_proveedor}`);
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al eliminar el proveedor" };
  }
}
