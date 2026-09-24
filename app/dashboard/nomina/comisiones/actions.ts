"use server";

import db from "@/database/connection";
import { ICommissionTier } from "@/interfaces/payroll_commission";
import {
  ITreatmentCommissionSettings,
  ITreatmentCommissionSettingsLogEntry,
} from "@/interfaces/payroll_treatment_commission";
import { ActionResult, assertPayrollAccess } from "@/lib/payroll/access";
import { commissionTierSchema, treatmentCommissionSettingsSchema } from "@/lib/payroll/schemas";
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

const TREATMENT_SETTINGS_LOG_LIMIT = 20;

/** Configuración de comisión por tratamiento de la empresa de la sesión, o null si no hay fila. */
export async function getTreatmentCommissionSettings(): Promise<ActionResult<ITreatmentCommissionSettings | null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  try {
    const rows = await db.queryParams(
      `SELECT CAST(s.importe_por_tratamiento AS float) AS importe_por_tratamiento,
              CAST(s.umbral_liquidacion AS float)      AS umbral_liquidacion,
              ISNULL(u.nombre, '')                  AS updated_by_nombre,
              CONVERT(varchar(19), s.updated_at, 120)  AS updated_at
         FROM [CentroPodologico].[payroll].[treatment_commission_settings] s
         LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = s.updated_by
        WHERE s.id_empresa = @id_empresa`,
      { id_empresa: access.data.id_empresa },
    );
    return { ok: true, data: (rows[0] as ITreatmentCommissionSettings | undefined) ?? null };
  } catch (error) {
    console.error("getTreatmentCommissionSettings", error);
    return { ok: false, message: "No se pudo cargar la configuración de comisión por tratamiento" };
  }
}

/** Las últimas 20 entradas de la bitácora de la empresa, de la más reciente a la más antigua. */
export async function getTreatmentCommissionSettingsLog(): Promise<
  ActionResult<ITreatmentCommissionSettingsLogEntry[]>
> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  try {
    const rows = await db.queryParams(
      `SELECT TOP (@limit)
              l.id_log,
              CAST(l.importe_por_tratamiento_anterior AS float) AS importe_por_tratamiento_anterior,
              CAST(l.importe_por_tratamiento_nuevo AS float)    AS importe_por_tratamiento_nuevo,
              CAST(l.umbral_liquidacion_anterior AS float)      AS umbral_liquidacion_anterior,
              CAST(l.umbral_liquidacion_nuevo AS float)         AS umbral_liquidacion_nuevo,
              ISNULL(u.nombre, '')                           AS updated_by_nombre,
              CONVERT(varchar(19), l.updated_at, 120)           AS updated_at
         FROM [CentroPodologico].[payroll].[treatment_commission_settings_log] l
         LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = l.updated_by
        WHERE l.id_empresa = @id_empresa
        ORDER BY l.updated_at DESC, l.id_log DESC`,
      { id_empresa: access.data.id_empresa, limit: TREATMENT_SETTINGS_LOG_LIMIT },
    );
    return { ok: true, data: rows as ITreatmentCommissionSettingsLogEntry[] };
  } catch (error) {
    console.error("getTreatmentCommissionSettingsLog", error);
    return { ok: false, message: "No se pudo cargar la bitácora de cambios" };
  }
}

/**
 * Guarda la configuración y su bitácora en una sola transacción. Si ningún valor cambió no escribe nada;
 * la fila se lee con UPDLOCK/HOLDLOCK para que dos guardados simultáneos no dupliquen ni pierdan una entrada.
 */
export async function updateTreatmentCommissionSettings(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_empresa, id_user } = access.data;

  const parsed = treatmentCommissionSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { importe_por_tratamiento, umbral_liquidacion } = parsed.data;

  try {
    await db.queryParams(
      `SET XACT_ABORT ON;
       BEGIN TRAN;

       DECLARE @new_importe decimal(12,2) = CAST(@importe_por_tratamiento AS decimal(12,2));
       DECLARE @new_umbral  decimal(12,2) = CAST(@umbral_liquidacion AS decimal(12,2));
       DECLARE @updated_at  datetime2(0)  = CAST(@updated_at_text AS datetime2(0));
       DECLARE @previous_importe decimal(12,2), @previous_umbral decimal(12,2), @has_row bit = 0;

       SELECT @previous_importe = importe_por_tratamiento,
              @previous_umbral  = umbral_liquidacion,
              @has_row          = 1
         FROM [CentroPodologico].[payroll].[treatment_commission_settings] WITH (UPDLOCK, HOLDLOCK)
        WHERE id_empresa = @id_empresa;

       IF @has_row = 1 AND @previous_importe = @new_importe AND @previous_umbral = @new_umbral
       BEGIN
         COMMIT;
         RETURN;
       END

       IF @has_row = 1
         UPDATE [CentroPodologico].[payroll].[treatment_commission_settings]
            SET importe_por_tratamiento = @new_importe,
                umbral_liquidacion      = @new_umbral,
                updated_by              = @updated_by,
                updated_at              = @updated_at
          WHERE id_empresa = @id_empresa;
       ELSE
         INSERT INTO [CentroPodologico].[payroll].[treatment_commission_settings]
           (id_empresa, importe_por_tratamiento, umbral_liquidacion, updated_by, updated_at)
         VALUES (@id_empresa, @new_importe, @new_umbral, @updated_by, @updated_at);

       INSERT INTO [CentroPodologico].[payroll].[treatment_commission_settings_log]
         (id_empresa, importe_por_tratamiento_anterior, importe_por_tratamiento_nuevo,
          umbral_liquidacion_anterior, umbral_liquidacion_nuevo, updated_by, updated_at)
       VALUES
         (@id_empresa, @previous_importe, @new_importe, @previous_umbral, @new_umbral, @updated_by, @updated_at);

       COMMIT;`,
      {
        id_empresa,
        importe_por_tratamiento,
        umbral_liquidacion,
        updated_by: id_user,
        updated_at_text: buildDate(new Date()),
      },
    );

    revalidatePath(COMMISSIONS_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("updateTreatmentCommissionSettings", error);
    return { ok: false, message: "No se pudo guardar la configuración de comisión por tratamiento" };
  }
}
