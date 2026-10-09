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
import { deleteTaxParameterSchema, taxParameterSchema } from "@/lib/payroll/taxParametersSchemas";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";

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
