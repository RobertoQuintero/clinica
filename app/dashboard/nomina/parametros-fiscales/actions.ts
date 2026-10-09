"use server";

import db from "@/database/connection";
import type {
  IPerception,
  ITaxParameter,
  ITaxParametersLogEntry,
  IWithholdingBracket,
} from "@/interfaces/payroll_tax_parameters";
import { ActionResult, assertPayrollAccess } from "@/lib/payroll/access";
import { TAX_PARAMETERS_LOG_PAGE_SIZE } from "@/lib/payroll/constants";
import {
  copyWithholdingTableSchema,
  createWithholdingBracketSchema,
  deleteTaxParameterSchema,
  deleteWithholdingBracketSchema,
  savePerceptionSchema,
  taxParameterSchema,
  updateWithholdingBracketSchema,
} from "@/lib/payroll/taxParametersSchemas";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";
import {
  BRACKET_ERROR_MARKERS,
  RESOLVE_WEEKLY_FREQUENCY_SQL,
  VALIDATE_BRACKET_SQL,
} from "./withholdingBracketSql";

/** Clave SAT c_PeriodicidadPago de la frecuencia semanal: la única tarifa ISR que captura esta pantalla (spec 69). */
const WEEKLY_FREQUENCY_SAT_KEY = "02";
const TAX_PARAMETERS_PATH = "/dashboard/nomina/parametros-fiscales";
const PARAMETER_NOT_FOUND_MARKER = "TAX_PARAMETER_NOT_FOUND";

/** Parámetros fiscales cuyo `vigente_desde` cae en el ejercicio, ordenados por clave y vigencia. */
export async function getTaxParametersPage(year: number): Promise<ActionResult<ITaxParameter[]>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  try {
    const rows = await db.queryParams(
      `SELECT p.id_tax_parameter,
              p.clave,
              CAST(p.valor AS float)                     AS valor,
              CONVERT(varchar(10), p.vigente_desde, 120) AS vigente_desde,
              ISNULL(u.nombre, '')                       AS updated_by_name,
              CONVERT(varchar(19), p.updated_at, 120)    AS updated_at
         FROM [CentroPodologico].[payroll].[tax_parameters] p
         LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = p.updated_by
        WHERE p.vigente_desde >= DATEFROMPARTS(@year, 1, 1)
          AND p.vigente_desde <  DATEFROMPARTS(@year + 1, 1, 1)
        ORDER BY p.clave, p.vigente_desde`,
      { year },
    );
    return { ok: true, data: rows as ITaxParameter[] };
  } catch (error) {
    console.error("getTaxParametersPage", error);
    return { ok: false, message: "No se pudieron cargar los parámetros fiscales" };
  }
}

/** Tramos de la tarifa ISR semanal del ejercicio, ordenados por límite inferior. */
export async function getWithholdingTable(year: number): Promise<ActionResult<IWithholdingBracket[]>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  try {
    const rows = await db.queryParams(
      `SELECT t.id_tarifa,
              t.ejercicio,
              t.id_payment_period,
              CAST(t.limite_inferior AS float)      AS limite_inferior,
              CAST(t.limite_superior AS float)      AS limite_superior,
              CAST(t.cuota_fija AS float)           AS cuota_fija,
              CAST(t.porcentaje_excedente AS float) AS porcentaje_excedente
         FROM [CentroPodologico].[payroll].[tablas_retencion] t
         JOIN [CentroPodologico].[RH].[payment_periods] pp ON pp.id_payment_period = t.id_payment_period
        WHERE t.ejercicio = @year
          AND pp.clave_sat = @weekly_sat_key
        ORDER BY t.limite_inferior`,
      { year, weekly_sat_key: WEEKLY_FREQUENCY_SAT_KEY },
    );
    return { ok: true, data: rows as IWithholdingBracket[] };
  } catch (error) {
    console.error("getWithholdingTable", error);
    return { ok: false, message: "No se pudo cargar la tarifa del ISR" };
  }
}

/** Catálogo completo de percepciones con su tope de exención estructurado. */
export async function getPerceptions(): Promise<ActionResult<IPerception[]>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  try {
    const rows = await db.query(
      `SELECT id_perception,
              clave_sat,
              description,
              id_taxed_exempt,
              tipo_limite_exencion,
              CAST(umas_limite AS float)       AS umas_limite,
              CAST(porcentaje_exento AS float) AS porcentaje_exento,
              periodicidad_limite,
              ISNULL(is_billed, 0)             AS is_billed,
              ISNULL(status, 0)                AS status
         FROM [CentroPodologico].[payroll].[perceptions]
        ORDER BY id_perception`,
    );
    return { ok: true, data: rows as IPerception[] };
  } catch (error) {
    console.error("getPerceptions", error);
    return { ok: false, message: "No se pudo cargar el catálogo de percepciones" };
  }
}

/** Las últimas 20 entradas de la bitácora de parámetros, de la más reciente a la más antigua. */
export async function getTaxParametersLog(): Promise<ActionResult<ITaxParametersLogEntry[]>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  try {
    const rows = await db.queryParams(
      `SELECT TOP (@limit)
              l.id_log,
              l.clave,
              CONVERT(varchar(10), l.vigente_desde, 120) AS vigente_desde,
              CAST(l.valor_anterior AS float)            AS valor_anterior,
              CAST(l.valor_nuevo AS float)               AS valor_nuevo,
              ISNULL(u.nombre, '')                       AS updated_by_name,
              CONVERT(varchar(19), l.updated_at, 120)    AS updated_at
         FROM [CentroPodologico].[payroll].[tax_parameters_log] l
         LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = l.updated_by
        ORDER BY l.updated_at DESC, l.id_log DESC`,
      { limit: TAX_PARAMETERS_LOG_PAGE_SIZE },
    );
    return { ok: true, data: rows as ITaxParametersLogEntry[] };
  } catch (error) {
    console.error("getTaxParametersLog", error);
    return { ok: false, message: "No se pudo cargar la bitácora de parámetros" };
  }
}

/**
 * Alta o edición de un parámetro por (clave, vigente_desde). La fila se lee con UPDLOCK/HOLDLOCK y la bitácora
 * se escribe en la misma transacción; un guardado sin cambios no escribe nada ni toca `updated_at`.
 */
export async function saveTaxParameter(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  const parsed = taxParameterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { clave, vigente_desde, valor } = parsed.data;

  try {
    await db.queryParams(
      `SET XACT_ABORT ON;
       BEGIN TRAN;

       DECLARE @new_value      decimal(18,4) = CAST(@valor AS decimal(18,4));
       DECLARE @effective_on   date          = CAST(@vigente_desde AS date);
       DECLARE @updated_at     datetime2(0)  = CAST(@updated_at_text AS datetime2(0));
       DECLARE @previous_value decimal(18,4), @has_row bit = 0;

       SELECT @previous_value = valor, @has_row = 1
         FROM [CentroPodologico].[payroll].[tax_parameters] WITH (UPDLOCK, HOLDLOCK)
        WHERE clave = @clave AND vigente_desde = @effective_on;

       IF @has_row = 1 AND @previous_value = @new_value
       BEGIN
         COMMIT;
         RETURN;
       END

       IF @has_row = 1
         UPDATE [CentroPodologico].[payroll].[tax_parameters]
            SET valor = @new_value, updated_by = @updated_by, updated_at = @updated_at
          WHERE clave = @clave AND vigente_desde = @effective_on;
       ELSE
         INSERT INTO [CentroPodologico].[payroll].[tax_parameters]
           (clave, valor, vigente_desde, updated_by, updated_at)
         VALUES (@clave, @new_value, @effective_on, @updated_by, @updated_at);

       INSERT INTO [CentroPodologico].[payroll].[tax_parameters_log]
         (clave, vigente_desde, valor_anterior, valor_nuevo, updated_by, updated_at)
       VALUES (@clave, @effective_on, @previous_value, @new_value, @updated_by, @updated_at);

       COMMIT;`,
      {
        clave,
        vigente_desde,
        valor,
        updated_by: access.data.id_user,
        updated_at_text: buildDate(new Date()),
      },
    );

    revalidatePath(TAX_PARAMETERS_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("saveTaxParameter", error);
    return { ok: false, message: "No se pudo guardar el parámetro fiscal" };
  }
}

/** Borra un parámetro y deja la baja en la bitácora (`valor_nuevo` NULL), en una sola transacción. */
export async function deleteTaxParameter(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  const parsed = deleteTaxParameterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await db.queryParams(
      `SET XACT_ABORT ON;
       BEGIN TRAN;

       DECLARE @updated_at datetime2(0) = CAST(@updated_at_text AS datetime2(0));
       DECLARE @clave varchar(40), @effective_on date, @previous_value decimal(18,4);

       SELECT @clave = clave, @effective_on = vigente_desde, @previous_value = valor
         FROM [CentroPodologico].[payroll].[tax_parameters] WITH (UPDLOCK, HOLDLOCK)
        WHERE id_tax_parameter = @id_tax_parameter;

       IF @clave IS NULL
         THROW 50020, '${PARAMETER_NOT_FOUND_MARKER}', 1;

       DELETE FROM [CentroPodologico].[payroll].[tax_parameters]
        WHERE id_tax_parameter = @id_tax_parameter;

       INSERT INTO [CentroPodologico].[payroll].[tax_parameters_log]
         (clave, vigente_desde, valor_anterior, valor_nuevo, updated_by, updated_at)
       VALUES (@clave, @effective_on, @previous_value, NULL, @updated_by, @updated_at);

       COMMIT;`,
      {
        id_tax_parameter: parsed.data.id_tax_parameter,
        updated_by: access.data.id_user,
        updated_at_text: buildDate(new Date()),
      },
    );

    revalidatePath(TAX_PARAMETERS_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("deleteTaxParameter", error);
    const message = (error as { message?: string }).message ?? "";
    return {
      ok: false,
      message: message.includes(PARAMETER_NOT_FOUND_MARKER)
        ? "El parámetro ya no existe"
        : "No se pudo eliminar el parámetro fiscal",
    };
  }
}

/** Traduce los errores de SQL Server de escritura de la tarifa a un mensaje en español. */
function describeBracketWriteError(error: unknown): string {
  const sqlError = error as { message?: string; number?: number };
  const message = sqlError.message ?? "";
  if (message.includes(BRACKET_ERROR_MARKERS.secondOpenBracket)) {
    return "Ya existe un tramo sin límite superior. Solo puede haber uno";
  }
  if (message.includes(BRACKET_ERROR_MARKERS.overlap)) {
    return "El rango se traslapa con otro tramo de la tarifa";
  }
  if (message.includes(BRACKET_ERROR_MARKERS.invalidBracket)) {
    return "Los límites, la cuota o el porcentaje del tramo no son válidos";
  }
  if (message.includes(BRACKET_ERROR_MARKERS.notFound)) {
    return "El tramo ya no existe";
  }
  if (message.includes(BRACKET_ERROR_MARKERS.weeklyFrequencyMissing)) {
    return "No existe la frecuencia semanal en el catálogo";
  }
  if (sqlError.number === 2627 || sqlError.number === 2601) {
    return "Ya existe un tramo que empieza en ese límite inferior";
  }
  return "No se pudo guardar el tramo de la tarifa";
}

/**
 * Alta (sin `id_tarifa`) o edición (con `id_tarifa`) de un tramo de la tarifa semanal. Valida rangos, tramo abierto
 * único y traslapes dentro de la transacción. `id_tarifa` no es IDENTITY: el alta calcula MAX + 1 con UPDLOCK/HOLDLOCK.
 */
export async function saveWithholdingBracket(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  const isEdit =
    typeof input === "object" && input !== null && "id_tarifa" in input && (input as { id_tarifa: unknown }).id_tarifa != null;
  const parsed = isEdit ? updateWithholdingBracketSchema.safeParse(input) : createWithholdingBracketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const bracket = parsed.data;

  try {
    if ("id_tarifa" in bracket) {
      await db.queryParams(
        `SET XACT_ABORT ON;
         BEGIN TRAN;
         ${RESOLVE_WEEKLY_FREQUENCY_SQL}

         DECLARE @ejercicio int;
         SELECT @ejercicio = ejercicio
           FROM [CentroPodologico].[payroll].[tablas_retencion] WITH (UPDLOCK, HOLDLOCK)
          WHERE id_tarifa = @id_tarifa AND id_payment_period = @weekly_id;
         IF @ejercicio IS NULL
           THROW 50034, '${BRACKET_ERROR_MARKERS.notFound}', 1;
         ${VALIDATE_BRACKET_SQL}

         UPDATE [CentroPodologico].[payroll].[tablas_retencion]
            SET limite_inferior = @lower, limite_superior = @upper,
                cuota_fija = @fixed, porcentaje_excedente = @pct
          WHERE id_tarifa = @id_tarifa;

         COMMIT;`,
        {
          weekly_sat_key: WEEKLY_FREQUENCY_SAT_KEY,
          id_tarifa: bracket.id_tarifa,
          lower: bracket.limite_inferior,
          upper: bracket.limite_superior,
          fixed: bracket.cuota_fija,
          pct: bracket.porcentaje_excedente,
        },
      );
    } else {
      await db.queryParams(
        `SET XACT_ABORT ON;
         BEGIN TRAN;
         ${RESOLVE_WEEKLY_FREQUENCY_SQL}

         DECLARE @id_tarifa int = 0;
         ${VALIDATE_BRACKET_SQL}

         DECLARE @next_id int;
         SELECT @next_id = ISNULL(MAX(id_tarifa), 0) + 1
           FROM [CentroPodologico].[payroll].[tablas_retencion] WITH (UPDLOCK, HOLDLOCK);

         INSERT INTO [CentroPodologico].[payroll].[tablas_retencion]
           (id_tarifa, limite_inferior, limite_superior, cuota_fija, porcentaje_excedente,
            id_payment_period, status, ejercicio)
         VALUES (@next_id, @lower, @upper, @fixed, @pct, @weekly_id, 1, @ejercicio);

         COMMIT;`,
        {
          weekly_sat_key: WEEKLY_FREQUENCY_SAT_KEY,
          ejercicio: bracket.ejercicio,
          lower: bracket.limite_inferior,
          upper: bracket.limite_superior,
          fixed: bracket.cuota_fija,
          pct: bracket.porcentaje_excedente,
        },
      );
    }

    revalidatePath(TAX_PARAMETERS_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("saveWithholdingBracket", error);
    return { ok: false, message: describeBracketWriteError(error) };
  }
}

export async function deleteWithholdingBracket(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  const parsed = deleteWithholdingBracketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const deletedRows = await db.queryParams(
      `DELETE t
       OUTPUT deleted.id_tarifa
         FROM [CentroPodologico].[payroll].[tablas_retencion] t
         JOIN [CentroPodologico].[RH].[payment_periods] pp ON pp.id_payment_period = t.id_payment_period
        WHERE t.id_tarifa = @id_tarifa AND pp.clave_sat = @weekly_sat_key`,
      { id_tarifa: parsed.data.id_tarifa, weekly_sat_key: WEEKLY_FREQUENCY_SAT_KEY },
    );
    if (deletedRows.length === 0) return { ok: false, message: "El tramo ya no existe" };

    revalidatePath(TAX_PARAMETERS_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("deleteWithholdingBracket", error);
    return { ok: false, message: "No se pudo eliminar el tramo de la tarifa" };
  }
}

/** Copia los tramos semanales del ejercicio anterior al destino. Falla si el destino ya tiene tramos. */
export async function copyWithholdingTableFromPreviousYear(input: unknown): Promise<ActionResult<number>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  const parsed = copyWithholdingTableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const targetYear = parsed.data.ejercicio_destino;

  try {
    const result = await db.queryParams(
      `SET XACT_ABORT ON;
       BEGIN TRAN;
       ${RESOLVE_WEEKLY_FREQUENCY_SQL}

       IF EXISTS (
         SELECT 1 FROM [CentroPodologico].[payroll].[tablas_retencion] WITH (UPDLOCK, HOLDLOCK)
          WHERE ejercicio = @target_year AND id_payment_period = @weekly_id
       )
         THROW 50035, '${BRACKET_ERROR_MARKERS.targetHasBrackets}', 1;

       IF NOT EXISTS (
         SELECT 1 FROM [CentroPodologico].[payroll].[tablas_retencion] WITH (UPDLOCK, HOLDLOCK)
          WHERE ejercicio = @target_year - 1 AND id_payment_period = @weekly_id
       )
         THROW 50036, '${BRACKET_ERROR_MARKERS.sourceEmpty}', 1;

       DECLARE @next_id int;
       SELECT @next_id = ISNULL(MAX(id_tarifa), 0)
         FROM [CentroPodologico].[payroll].[tablas_retencion] WITH (UPDLOCK, HOLDLOCK);

       INSERT INTO [CentroPodologico].[payroll].[tablas_retencion]
         (id_tarifa, limite_inferior, limite_superior, cuota_fija, porcentaje_excedente,
          id_payment_period, status, ejercicio)
       SELECT @next_id + ROW_NUMBER() OVER (ORDER BY limite_inferior),
              limite_inferior, limite_superior, cuota_fija, porcentaje_excedente,
              @weekly_id, 1, @target_year
         FROM [CentroPodologico].[payroll].[tablas_retencion]
        WHERE ejercicio = @target_year - 1 AND id_payment_period = @weekly_id;

       DECLARE @copied_count int = @@ROWCOUNT;
       COMMIT;
       SELECT @copied_count AS copied_count;`,
      { weekly_sat_key: WEEKLY_FREQUENCY_SAT_KEY, target_year: targetYear },
    );

    revalidatePath(TAX_PARAMETERS_PATH);
    return { ok: true, data: Number(result[0]?.copied_count ?? 0) };
  } catch (error) {
    console.error("copyWithholdingTableFromPreviousYear", error);
    const message = (error as { message?: string }).message ?? "";
    if (message.includes(BRACKET_ERROR_MARKERS.targetHasBrackets)) {
      return { ok: false, message: `El ejercicio ${targetYear} ya tiene tramos. Elimínalos antes de copiar` };
    }
    if (message.includes(BRACKET_ERROR_MARKERS.sourceEmpty)) {
      return { ok: false, message: `El ejercicio ${targetYear - 1} no tiene tarifa semanal que copiar` };
    }
    return { ok: false, message: "No se pudo copiar la tarifa del ejercicio anterior" };
  }
}

/**
 * Guarda el tope de exención estructurado de una percepción. El schema refleja `CK_perceptions_exencion`;
 * si algo se cuela, el CHECK de SQL lo rechaza. `exempt_limit` (texto libre) no se toca.
 */
export async function savePerception(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  const parsed = savePerceptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const perception = parsed.data;

  try {
    const updatedRows = await db.queryParams(
      `UPDATE [CentroPodologico].[payroll].[perceptions]
          SET tipo_limite_exencion = @tipo_limite_exencion,
              umas_limite          = CAST(@umas_limite AS decimal(9,4)),
              porcentaje_exento    = CAST(@porcentaje_exento AS decimal(5,2)),
              periodicidad_limite  = @periodicidad_limite
       OUTPUT inserted.id_perception
        WHERE id_perception = @id_perception`,
      {
        id_perception: perception.id_perception,
        tipo_limite_exencion: perception.tipo_limite_exencion,
        umas_limite: perception.umas_limite,
        porcentaje_exento: perception.porcentaje_exento,
        periodicidad_limite: perception.periodicidad_limite,
      },
    );
    if (updatedRows.length === 0) return { ok: false, message: "La percepción ya no existe" };

    revalidatePath(TAX_PARAMETERS_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("savePerception", error);
    const sqlError = error as { number?: number };
    return {
      ok: false,
      message: sqlError.number === 547
        ? "El tope de exención no es válido para el tipo elegido"
        : "No se pudo guardar el tope de exención",
    };
  }
}
