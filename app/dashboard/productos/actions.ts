"use server";

import db from "@/database/connection";
import { IProduct } from "@/interfaces/product";
import { IProductCategory } from "@/interfaces/product_category";
import { IUnitMeasurement } from "@/interfaces/unit_measurement";
import { IAuthUser } from "@/interfaces/auth";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { ActionResult } from "@/app/actions/auth";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET_SEED!);

async function getActiveUser(): Promise<IAuthUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) throw new Error("No autenticado");
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as IAuthUser;
}

export async function getProducts(): Promise<IProduct[]> {
  const { id_empresa } = await getActiveUser();
  const data = await db.queryParams(
    `SELECT [id_product],
            [name],
            [id_category],
            [brand],
            [presentation],
            [id_unit_measurement],
            [size],
            [price],
            [sale_price],
            [product_code],
            [id_supplier],
            [pieces],
            [min_stock],
            [max_stock],
            [auto_consume],
            [consumption_per_consultation],
            [id_empresa],
            [description],
            CONVERT(varchar(19), [created_at], 120) AS created_at,
            [activo],
            [status],
            [split],
            [url_product],
            [bono_venta],
            [url_compra]
       FROM [CentroPodologico].[inventory].[Products]
      WHERE [status] = 1
        AND [id_empresa] = @id_empresa
      ORDER BY [name]`,
    { id_empresa }
  );
  return data as IProduct[];
}

export interface IProductDetail {
  product:       IProduct;
  categoryName:  string;
  supplierName:  string;
  unitName:      string;
}

export async function getProductDetail(
  id_product: number
): Promise<ActionResult<IProductDetail>> {
  try {
    const { id_empresa } = await getActiveUser();
    const data = await db.queryParams(
      `SELECT p.[id_product],
              p.[name],
              p.[id_category],
              p.[brand],
              p.[presentation],
              p.[id_unit_measurement],
              p.[size],
              p.[price],
              p.[sale_price],
              p.[product_code],
              p.[id_supplier],
              p.[pieces],
              p.[min_stock],
              p.[max_stock],
              p.[auto_consume],
              p.[consumption_per_consultation],
              p.[id_empresa],
              p.[description],
              CONVERT(varchar(19), p.[created_at], 120) AS created_at,
              p.[activo],
              p.[status],
              p.[split],
              p.[url_product],
              p.[bono_venta],
              p.[url_compra],
              c.[name]           AS category_name,
              s.[nombre_corto]   AS supplier_name,
              u.[name]           AS unit_name
         FROM [CentroPodologico].[inventory].[Products] p
         LEFT JOIN [CentroPodologico].[inventory].[categories] c ON c.[id_category] = p.[id_category]
         LEFT JOIN [CentroPodologico].[inventory].[proveedores] s ON s.[id_proveedor] = p.[id_supplier]
         LEFT JOIN [CentroPodologico].[inventory].[units_measurement] u ON u.[id_unit_measurement] = p.[id_unit_measurement]
        WHERE p.[id_product] = @id_product
          AND p.[id_empresa] = @id_empresa`,
      { id_product, id_empresa }
    );

    const row = data[0];
    if (!row) {
      return { ok: false, message: "Producto no encontrado" };
    }

    const {
      category_name,
      supplier_name,
      unit_name,
      ...product
    } = row;

    return {
      ok: true,
      data: {
        product: product as IProduct,
        categoryName: category_name ?? "",
        supplierName: supplier_name ?? "",
        unitName: unit_name ?? "",
      },
    };
  } catch {
    return { ok: false, message: "Producto no encontrado" };
  }
}

export async function getCategories(): Promise<IProductCategory[]> {
  const { id_empresa } = await getActiveUser();
  const data = await db.queryParams(
    `SELECT [id_category],
            [name],
            [status],
            [activo],
            [id_empresa]
       FROM [CentroPodologico].[inventory].[categories]
      WHERE [status] = 1
        AND [id_empresa] = @id_empresa
      ORDER BY [name]`,
    { id_empresa }
  );
  return data as IProductCategory[];
}

export async function getUnitsMeasurement(): Promise<IUnitMeasurement[]> {
  const data = await db.queryParams(
    `SELECT [id_unit_measurement],
            [id_type],
            [name],
            [code],
            [value],
            [status]
       FROM [CentroPodologico].[inventory].[units_measurement]
      WHERE [status] = 1
      ORDER BY [name]`,
    {}
  );
  return data as IUnitMeasurement[];
}

export async function saveProduct(
  form: Omit<IProduct, "id_empresa" | "status" | "created_at">
): Promise<{ ok: boolean; message?: string }> {
  try {
    const {
      id_product,
      name,
      id_category,
      brand,
      presentation,
      id_unit_measurement,
      size,
      price,
      sale_price,
      product_code,
      id_supplier,
      pieces,
      min_stock,
      max_stock,
      auto_consume,
      consumption_per_consultation,
      description,
      activo,
      split,
      url_product,
      bono_venta,
      url_compra,
    } = form;

    if (!name || !name.trim()) {
      return { ok: false, message: "El nombre es obligatorio" };
    }

    // El rango de stock debe ser consistente: un máximo menor al mínimo
    // rompería silenciosamente el tope de suggested_quantity en getSuggestedProducts.
    if (
      max_stock !== null && max_stock !== undefined &&
      min_stock !== null && min_stock !== undefined &&
      Number(max_stock) < Number(min_stock)
    ) {
      return { ok: false, message: "El Stock Máximo no puede ser menor al Stock Mínimo" };
    }

    // Si el producto se consume automáticamente en cada consulta, la cantidad
    // por consulta es obligatoria y debe ser positiva (ver spec 13).
    if (auto_consume === true) {
      if (
        consumption_per_consultation === null ||
        consumption_per_consultation === undefined ||
        Number(consumption_per_consultation) <= 0
      ) {
        return {
          ok: false,
          message:
            "La cantidad por consulta es obligatoria y debe ser mayor a 0 cuando el producto se consume automáticamente",
        };
      }
    }
    const effectiveConsumptionPerConsultation = auto_consume === true
      ? consumption_per_consultation
      : null;

    // Todo producto de categoría "Venta" (4) requiere precio de venta, sin
    // importar si se compra por paquete/caja (split) o no (ver spec 37).
    if (id_category === 4) {
      if (sale_price === null || sale_price === undefined || Number(sale_price) <= 0) {
        return {
          ok: false,
          message:
            "El precio de venta es obligatorio para productos de categoría Venta",
        };
      }
    }

    const { id_empresa, id_role } = await getActiveUser();

    // "El Stock Mínimo solo lo puede ajustar el administrador" (Inventario.md).
    // max_stock comparte la misma restricción de rol: juntos definen el rango
    // de stock del producto. Un rol no autorizado no puede tocar ninguno de los
    // dos campos: se ignora lo enviado y se conserva el valor previo (o null en
    // un producto nuevo).
    const canEditMinStock = id_role === 1 || id_role === 4;
    let effectiveMinStock = min_stock;
    let effectiveMaxStock = max_stock;
    if (!canEditMinStock) {
      if (id_product === 0) {
        effectiveMinStock = null;
        effectiveMaxStock = null;
      } else {
        const existing = await db.queryParams(
          `SELECT [min_stock], [max_stock]
             FROM [CentroPodologico].[inventory].[Products]
            WHERE [id_product] = @id_product
              AND [id_empresa] = @id_empresa`,
          { id_product, id_empresa }
        );
        effectiveMinStock = existing[0]?.min_stock ?? null;
        effectiveMaxStock = existing[0]?.max_stock ?? null;
      }
    }

    const commonParams = {
      name,
      id_category,
      brand,
      presentation,
      id_unit_measurement,
      size,
      price,
      sale_price,
      product_code,
      id_supplier,
      pieces,
      min_stock: effectiveMinStock,
      max_stock: effectiveMaxStock,
      auto_consume,
      consumption_per_consultation: effectiveConsumptionPerConsultation,
      description,
      activo,
      split,
      url_product,
      bono_venta,
      url_compra,
    };

    if (id_product === 0) {
      await db.queryParams(
        `INSERT INTO [CentroPodologico].[inventory].[Products]
           ([id_product],[name],[id_category],[brand],[presentation],[id_unit_measurement],
            [size],[price],[sale_price],[product_code],[id_supplier],[pieces],[min_stock],
            [max_stock],[auto_consume],[consumption_per_consultation],[id_empresa],[description],
            [created_at],[activo],[status],[split],[url_product],[bono_venta],[url_compra])
         VALUES (
           (SELECT ISNULL(MAX([id_product]), 0) + 1 FROM [CentroPodologico].[inventory].[Products]),
           @name,@id_category,@brand,@presentation,@id_unit_measurement,
           @size,@price,@sale_price,@product_code,@id_supplier,@pieces,@min_stock,
           @max_stock,@auto_consume,@consumption_per_consultation,@id_empresa,@description,
           @created_at,@activo,1,@split,@url_product,@bono_venta,@url_compra
         )`,
        { ...commonParams, id_empresa, created_at: buildDate(new Date()) }
      );
    } else {
      await db.queryParams(
        `UPDATE [CentroPodologico].[inventory].[Products] SET
           [name]                = @name,
           [id_category]         = @id_category,
           [brand]                = @brand,
           [presentation]        = @presentation,
           [id_unit_measurement] = @id_unit_measurement,
           [size]                 = @size,
           [price]                = @price,
           [sale_price]           = @sale_price,
           [product_code]        = @product_code,
           [id_supplier]         = @id_supplier,
           [pieces]               = @pieces,
           [min_stock]            = @min_stock,
           [max_stock]            = @max_stock,
           [auto_consume]         = @auto_consume,
           [consumption_per_consultation] = @consumption_per_consultation,
           [description]         = @description,
           [activo]               = @activo,
           [split]                = @split,
           [url_product]         = @url_product,
           [bono_venta]          = @bono_venta,
           [url_compra]          = @url_compra
         WHERE [id_product] = @id_product
           AND [id_empresa] = @id_empresa`,
        { id_product, id_empresa, ...commonParams }
      );
    }

    revalidatePath("/dashboard/productos");
    return { ok: true };
  } catch(error) {
    
    return { ok: false, message: "Error al guardar el producto" };
  }
}

export async function deleteProduct(
  id_product: number
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { id_empresa } = await getActiveUser();
    await db.queryParams(
      `UPDATE [CentroPodologico].[inventory].[Products]
          SET [status] = 0
        WHERE [id_product] = @id_product
          AND [id_empresa] = @id_empresa`,
      { id_product, id_empresa }
    );
    revalidatePath("/dashboard/productos");
    return { ok: true };
  } catch {
    return { ok: false, message: "Error al eliminar el producto" };
  }
}
