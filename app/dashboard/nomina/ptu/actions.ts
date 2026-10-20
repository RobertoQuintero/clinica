"use server";

import db from "@/database/connection";
import type { IPtuDistribution } from "@/interfaces/payroll_ptu";
import { ActionResult, assertPayrollAccess } from "@/lib/payroll/access";
import { calculatePtuDistribution } from "@/lib/payroll/ptuDistribution";
import { PTU_DISTRIBUTION_SELECT } from "@/lib/payroll/ptuDistributionSql";
import { lockPtuDistribution, recalculatePtuDistribution } from "@/lib/payroll/ptuRecalculation";
import {
  createPtuDistributionSchema,
  ptuDistributionIdSchema,
  updatePtuDistributionParametersSchema,
} from "@/lib/payroll/ptuSchemas";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";

const PTU_PATH = "/dashboard/nomina/ptu";
const CLOSED_DISTRIBUTION_MESSAGE = "El reparto está cerrado. Reábrelo para modificarlo.";
const DISTRIBUTION_NOT_FOUND_MESSAGE = "El reparto no existe";

function buildDuplicateDistributionMessage(ejercicio: number): string {
  return `Ya existe el reparto de PTU de ${ejercicio}`;
}

/** SQL Server 2627 / 2601: violación de índice o llave única. */
function isUniqueViolation(error: unknown): boolean {
  const sqlError = error as { number?: number; message?: string } | null;
  return sqlError?.number === 2627 || sqlError?.number === 2601;
}

export async function getPtuDistributions(): Promise<ActionResult<IPtuDistribution[]>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  try {
    const rows = (await db.queryParams(
      `SELECT ${PTU_DISTRIBUTION_SELECT}
         FROM [CentroPodologico].[payroll].[ptu_distributions] d
        WHERE d.id_empresa = @id_empresa
        ORDER BY d.ejercicio DESC`,
      { id_empresa: access.data.id_empresa },
    )) as IPtuDistribution[];
    return { ok: true, data: rows };
  } catch (error) {
    console.error("getPtuDistributions", error);
    return { ok: false, message: "No se pudieron cargar los repartos de PTU" };
  }
}

export async function createPtuDistribution(rawInput: unknown): Promise<ActionResult<number>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const parsed = createPtuDistributionSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const input = parsed.data;

  try {
    const newId = await db.transaction(async (tx) => {
      const duplicates = await tx.queryParams(
        `SELECT 1 AS found
           FROM [CentroPodologico].[payroll].[ptu_distributions] WITH (UPDLOCK, HOLDLOCK)
          WHERE id_empresa = @id_empresa AND ejercicio = @ejercicio`,
        { id_empresa: access.data.id_empresa, ejercicio: input.ejercicio },
      );
      if (duplicates.length > 0) return null;

      // Sin trabajadores todavía: solo el fondo y las mitades salen de los parámetros.
      const { totals } = calculatePtuDistribution(input, [], new Map());
      const now = buildDate(new Date());
      const inserted = await tx.queryParams(
        `INSERT INTO [CentroPodologico].[payroll].[ptu_distributions]
           ([id_empresa],[ejercicio],[tipo_persona],[renta_gravable],[ptu_no_cobrada_anterior],[factor_tres_meses],
            [fondo],[mitad_dias],[mitad_salario],[total_dias],[total_salario_reparto],[tope_salario_diario_confianza],
            [total_repartido],[remanente_topes],[remanente_redondeo],[created_by],[created_at],[updated_at])
         OUTPUT INSERTED.[id_ptu_distribution]
         VALUES
           (@id_empresa,@ejercicio,@tipo_persona,@renta_gravable,@ptu_no_cobrada_anterior,@factor_tres_meses,
            @fondo,@mitad_dias,@mitad_salario,@total_dias,@total_salario_reparto,@tope_salario_diario_confianza,
            @total_repartido,@remanente_topes,@remanente_redondeo,@created_by,@created_at,@updated_at)`,
        {
          ...totals,
          id_empresa: access.data.id_empresa,
          ejercicio: input.ejercicio,
          tipo_persona: input.tipo_persona,
          renta_gravable: input.renta_gravable,
          ptu_no_cobrada_anterior: input.ptu_no_cobrada_anterior,
          factor_tres_meses: input.factor_tres_meses,
          created_by: access.data.id_user,
          created_at: now,
          updated_at: now,
        },
      );
      return (inserted[0] as { id_ptu_distribution: number }).id_ptu_distribution;
    });

    if (newId === null) return { ok: false, message: buildDuplicateDistributionMessage(input.ejercicio) };
    revalidatePath(PTU_PATH);
    return { ok: true, data: newId };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, message: buildDuplicateDistributionMessage(input.ejercicio) };
    console.error("createPtuDistribution", error);
    return { ok: false, message: "No se pudo crear el reparto de PTU" };
  }
}

/** Parámetros editables con la etiqueta que se escribe en la bitácora (`campo`). */
const EDITABLE_PARAMETERS = [
  "tipo_persona",
  "renta_gravable",
  "ptu_no_cobrada_anterior",
  "factor_tres_meses",
] as const;

export async function updatePtuDistributionParameters(rawInput: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const parsed = updatePtuDistributionParametersSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const input = parsed.data;

  try {
    const outcome = await db.transaction(async (tx) => {
      const distribution = await lockPtuDistribution(tx, input.id_ptu_distribution, access.data.id_empresa);
      if (!distribution) return "not_found" as const;
      if (distribution.estado === "C") return "closed" as const;

      const changedParameters = EDITABLE_PARAMETERS.filter(
        (parameter) => String(distribution[parameter]) !== String(input[parameter]),
      );
      if (changedParameters.length === 0) return "unchanged" as const;

      const now = buildDate(new Date());
      await tx.queryParams(
        `UPDATE [CentroPodologico].[payroll].[ptu_distributions]
            SET [tipo_persona] = @tipo_persona, [renta_gravable] = @renta_gravable,
                [ptu_no_cobrada_anterior] = @ptu_no_cobrada_anterior, [factor_tres_meses] = @factor_tres_meses,
                [updated_at] = @updated_at
          WHERE [id_ptu_distribution] = @id_ptu_distribution`,
        {
          id_ptu_distribution: distribution.id_ptu_distribution,
          tipo_persona: input.tipo_persona,
          renta_gravable: input.renta_gravable,
          ptu_no_cobrada_anterior: input.ptu_no_cobrada_anterior,
          factor_tres_meses: input.factor_tres_meses,
          updated_at: now,
        },
      );

      await recalculatePtuDistribution(tx, {
        ...distribution,
        renta_gravable: input.renta_gravable,
        ptu_no_cobrada_anterior: input.ptu_no_cobrada_anterior,
        factor_tres_meses: input.factor_tres_meses,
      });

      // Una entrada por parámetro que cambió de verdad.
      for (const parameter of changedParameters) {
        await tx.queryParams(
          `INSERT INTO [CentroPodologico].[payroll].[ptu_distribution_log]
             ([id_ptu_distribution],[id_empleado],[accion],[campo],[valor_anterior],[valor_nuevo],[changed_by],[changed_at])
           VALUES (@id_ptu_distribution, NULL, 'P', @campo, @valor_anterior, @valor_nuevo, @changed_by, @changed_at)`,
          {
            id_ptu_distribution: distribution.id_ptu_distribution,
            campo: parameter,
            valor_anterior: String(distribution[parameter]),
            valor_nuevo: String(input[parameter]),
            changed_by: access.data.id_user,
            changed_at: now,
          },
        );
      }
      return "updated" as const;
    });

    if (outcome === "not_found") return { ok: false, message: DISTRIBUTION_NOT_FOUND_MESSAGE };
    if (outcome === "closed") return { ok: false, message: CLOSED_DISTRIBUTION_MESSAGE };
    if (outcome === "updated") {
      revalidatePath(PTU_PATH);
      revalidatePath(`${PTU_PATH}/${input.id_ptu_distribution}`);
    }
    return { ok: true, data: null };
  } catch (error) {
    console.error("updatePtuDistributionParameters", error);
    return { ok: false, message: "No se pudieron guardar los parámetros del reparto" };
  }
}

/** Solo en borrador. Las filas de trabajadores y la bitácora se borran en cascada. */
export async function deletePtuDistribution(rawInput: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const parsed = ptuDistributionIdSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { id_ptu_distribution } = parsed.data;

  try {
    const outcome = await db.transaction(async (tx) => {
      const distribution = await lockPtuDistribution(tx, id_ptu_distribution, access.data.id_empresa);
      if (!distribution) return "not_found" as const;
      if (distribution.estado === "C") return "closed" as const;
      await tx.queryParams(
        `DELETE FROM [CentroPodologico].[payroll].[ptu_distributions] WHERE [id_ptu_distribution] = @id_ptu_distribution`,
        { id_ptu_distribution },
      );
      return "deleted" as const;
    });

    if (outcome === "not_found") return { ok: false, message: DISTRIBUTION_NOT_FOUND_MESSAGE };
    if (outcome === "closed") return { ok: false, message: "Solo se puede eliminar un reparto en borrador" };
    revalidatePath(PTU_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("deletePtuDistribution", error);
    return { ok: false, message: "No se pudo eliminar el reparto" };
  }
}
