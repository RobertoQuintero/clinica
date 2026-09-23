"use server";

import db from "@/database/connection";
import { ICommissionTier } from "@/interfaces/payroll_commission";
import { ActionResult, assertPayrollAccess } from "@/lib/payroll/access";
import { commissionTierSchema } from "@/lib/payroll/schemas";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const COMMISSIONS_PATH = "/dashboard/nomina/comisiones";
const TIER_OVERLAP_MARKER = "TIER_OVERLAP";
const TIER_SECOND_OPEN_MARKER = "TIER_SECOND_OPEN";
const TIER_NOT_FOUND_MARKER = "TIER_NOT_FOUND";
const TIER_NOT_FOUND_MESSAGE = "El tramo no existe";

const updateCommissionTierSchema = z.object({
  id_commission_tier: z.number().int().positive("Tramo inválido"),
  tier: commissionTierSchema,
});

/** Traduce los errores de SQL Server de escritura de tramos a un mensaje en español. */
function describeTierWriteError(error: unknown): string {
  const sqlError = error as { message?: string; number?: number };
  if (sqlError.message?.includes(TIER_SECOND_OPEN_MARKER)) {
    return "Ya existe un tramo sin máximo. Solo puede haber uno";
  }
  if (sqlError.message?.includes(TIER_OVERLAP_MARKER)) {
    return "El rango se traslapa con otro tramo de comisión";
  }
  if (sqlError.message?.includes(TIER_NOT_FOUND_MARKER)) {
    return TIER_NOT_FOUND_MESSAGE;
  }
  if (sqlError.number === 2627 || sqlError.number === 2601) {
    return "Ya existe un tramo que empieza en ese número de consultas";
  }
  if (sqlError.number === 547) {
    return "El rango o el importe del tramo no son válidos";
  }
  return "No se pudo guardar el tramo de comisión";
}

/**
 * Bloquea los tramos de la empresa y valida tramo abierto único y solapamiento dentro de la
 * misma transacción que escribe; `@id_commission_tier` es 0 en un alta, así ninguna fila se excluye.
 */
const VALIDATE_TIER_RANGE_SQL = `
  IF @max_consultas IS NULL AND EXISTS (
    SELECT 1 FROM [CentroPodologico].[payroll].[commission_tiers] WITH (UPDLOCK, HOLDLOCK)
     WHERE id_empresa = @id_empresa
       AND id_commission_tier <> @id_commission_tier
       AND max_consultas IS NULL
  )
    THROW 50011, '${TIER_SECOND_OPEN_MARKER}', 1;

  IF EXISTS (
    SELECT 1 FROM [CentroPodologico].[payroll].[commission_tiers] WITH (UPDLOCK, HOLDLOCK)
     WHERE id_empresa = @id_empresa
       AND id_commission_tier <> @id_commission_tier
       AND (@max_consultas IS NULL OR min_consultas <= @max_consultas)
       AND (max_consultas IS NULL OR max_consultas >= @min_consultas)
  )
    THROW 50010, '${TIER_OVERLAP_MARKER}', 1;`;

export async function getCommissionTiers(): Promise<ActionResult<ICommissionTier[]>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  try {
    const rows = await db.queryParams(
      `SELECT id_commission_tier, min_consultas, max_consultas, CAST(importe AS float) AS importe
         FROM [CentroPodologico].[payroll].[commission_tiers]
        WHERE id_empresa = @id_empresa
        ORDER BY min_consultas`,
      { id_empresa: access.data.id_empresa },
    );
    return { ok: true, data: rows as ICommissionTier[] };
  } catch (error) {
    console.error("getCommissionTiers", error);
    return { ok: false, message: "No se pudieron cargar los tramos de comisión" };
  }
}

export async function createCommissionTier(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_empresa, id_user } = access.data;

  const parsed = commissionTierSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { min_consultas, max_consultas, importe } = parsed.data;

  try {
    await db.queryParams(
      `SET XACT_ABORT ON;
       BEGIN TRAN;
       ${VALIDATE_TIER_RANGE_SQL}

       INSERT INTO [CentroPodologico].[payroll].[commission_tiers]
         (id_empresa, min_consultas, max_consultas, importe, created_by, created_at)
       VALUES
         (@id_empresa, @min_consultas, @max_consultas, @importe, @created_by, CAST(@created_at AS datetime2(0)));

       COMMIT;`,
      {
        id_empresa,
        id_commission_tier: 0,
        min_consultas,
        max_consultas,
        importe,
        created_by: id_user,
        created_at: buildDate(new Date()),
      },
    );

    revalidatePath(COMMISSIONS_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("createCommissionTier", error);
    return { ok: false, message: describeTierWriteError(error) };
  }
}

export async function updateCommissionTier(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_empresa } = access.data;

  const parsed = updateCommissionTierSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { id_commission_tier, tier } = parsed.data;

  try {
    await db.queryParams(
      `SET XACT_ABORT ON;
       BEGIN TRAN;

       IF NOT EXISTS (
         SELECT 1 FROM [CentroPodologico].[payroll].[commission_tiers] WITH (UPDLOCK, HOLDLOCK)
          WHERE id_commission_tier = @id_commission_tier AND id_empresa = @id_empresa
       )
         THROW 50012, '${TIER_NOT_FOUND_MARKER}', 1;
       ${VALIDATE_TIER_RANGE_SQL}

       UPDATE [CentroPodologico].[payroll].[commission_tiers]
          SET min_consultas = @min_consultas,
              max_consultas = @max_consultas,
              importe       = @importe,
              updated_at    = CAST(@updated_at AS datetime2(0))
        WHERE id_commission_tier = @id_commission_tier AND id_empresa = @id_empresa;

       COMMIT;`,
      {
        id_empresa,
        id_commission_tier,
        min_consultas: tier.min_consultas,
        max_consultas: tier.max_consultas,
        importe: tier.importe,
        updated_at: buildDate(new Date()),
      },
    );

    revalidatePath(COMMISSIONS_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("updateCommissionTier", error);
    return { ok: false, message: describeTierWriteError(error) };
  }
}

export async function deleteCommissionTier(idCommissionTier: number): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  if (!Number.isInteger(idCommissionTier) || idCommissionTier <= 0) {
    return { ok: false, message: "Tramo inválido" };
  }

  try {
    const deletedRows = await db.queryParams(
      `DELETE FROM [CentroPodologico].[payroll].[commission_tiers]
       OUTPUT deleted.id_commission_tier
        WHERE id_commission_tier = @id_commission_tier AND id_empresa = @id_empresa`,
      { id_commission_tier: idCommissionTier, id_empresa: access.data.id_empresa },
    );
    if (deletedRows.length === 0) return { ok: false, message: TIER_NOT_FOUND_MESSAGE };

    revalidatePath(COMMISSIONS_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("deleteCommissionTier", error);
    return { ok: false, message: "No se pudo eliminar el tramo de comisión" };
  }
}
