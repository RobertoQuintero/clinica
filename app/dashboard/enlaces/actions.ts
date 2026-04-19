"use server";

import db from "@/database/connection";
import { IPatologiaUrl } from "@/interfaces/patologia_url";
import { revalidatePath } from "next/cache";

export async function getEnlaces(): Promise<IPatologiaUrl[]> {
  const data = await db.query(
    `SELECT [id_patologia_url],
            [nombre_patologia],
            [url],
            [status]
       FROM [CentroPodologico].[dbo].[patologia_urls]
      ORDER BY [nombre_patologia]`
  );
  return data as IPatologiaUrl[];
}

export async function saveEnlace(
  form: Pick<IPatologiaUrl, "id_patologia_url" | "url" | "status">
): Promise<{ ok: boolean; message?: string }> {
  try {
    const { id_patologia_url, url, status } = form;
    await db.queryParams(
      `UPDATE [CentroPodologico].[dbo].[patologia_urls]
          SET [url]    = @url,
              [status] = @status
        WHERE [id_patologia_url] = @id_patologia_url`,
      { id_patologia_url, url, status }
    );
    revalidatePath("/dashboard/enlaces");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, message: err instanceof Error ? err.message : "Error al guardar" };
  }
}
