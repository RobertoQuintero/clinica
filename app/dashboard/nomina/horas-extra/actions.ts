"use server";

import db from "@/database/connection";
import { IOvertimeSettings, IOvertimeSettingsLogEntry } from "@/interfaces/payroll_overtime";
import { ActionResult, assertPayrollAccess } from "@/lib/payroll/access";
import { overtimeSettingsSchema } from "@/lib/payroll/schemas";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";

const OVERTIME_PATH = "/dashboard/nomina/horas-extra";
const OVERTIME_SETTINGS_LOG_LIMIT = 20;

/** Configuración de horas extra de la empresa de la sesión, o null si no hay fila. */
export async function getOvertimeSettings(): Promise<ActionResult<IOvertimeSettings | null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  try {
    const rows = await db.queryParams(
      `SELECT s.id_empresa,
              CAST(s.limite_horas_dobles_periodo AS float) AS limite_horas_dobles_periodo,
              CAST(s.tope_horas_dia AS float)              AS tope_horas_dia,
              s.updated_by,
              CONVERT(varchar(19), s.updated_at, 120)      AS updated_at
         FROM [CentroPodologico].[payroll].[overtime_settings] s
        WHERE s.id_empresa = @id_empresa`,
      { id_empresa: access.data.id_empresa },
    );
    return { ok: true, data: (rows[0] as IOvertimeSettings | undefined) ?? null };
  } catch (error) {
    console.error("getOvertimeSettings", error);
    return { ok: false, message: "No se pudo cargar la configuración de horas extra" };
  }
}

/** Las últimas 20 entradas de la bitácora de la empresa, de la más reciente a la más antigua. */
export async function getOvertimeSettingsLog(): Promise<ActionResult<IOvertimeSettingsLogEntry[]>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  try {
    const rows = await db.queryParams(
      `SELECT TOP (@limit)
              l.id_log,
              CAST(l.limite_horas_dobles_periodo_anterior AS float) AS limite_horas_dobles_periodo_anterior,
              CAST(l.limite_horas_dobles_periodo_nuevo AS float)    AS limite_horas_dobles_periodo_nuevo,
              CAST(l.tope_horas_dia_anterior AS float)              AS tope_horas_dia_anterior,
              CAST(l.tope_horas_dia_nuevo AS float)                 AS tope_horas_dia_nuevo,
              ISNULL(u.nombre, '')                                  AS updated_by_name,
              CONVERT(varchar(19), l.updated_at, 120)               AS updated_at
         FROM [CentroPodologico].[payroll].[overtime_settings_log] l
         LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = l.updated_by
        WHERE l.id_empresa = @id_empresa
        ORDER BY l.updated_at DESC, l.id_log DESC`,
      { id_empresa: access.data.id_empresa, limit: OVERTIME_SETTINGS_LOG_LIMIT },
    );
    return { ok: true, data: rows as IOvertimeSettingsLogEntry[] };
  } catch (error) {
    console.error("getOvertimeSettingsLog", error);
    return { ok: false, message: "No se pudo cargar la bitácora de cambios" };
  }
}

/**
 * Guarda la configuración y su bitácora en una sola transacción. Si ningún valor cambió no escribe nada;
 * la fila se lee con UPDLOCK/HOLDLOCK para que dos guardados simultáneos no dupliquen ni pierdan una entrada.
 */
export async function updateOvertimeSettings(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_empresa, id_user } = access.data;

  const parsed = overtimeSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { limite_horas_dobles_periodo, tope_horas_dia } = parsed.data;

  try {
    await db.queryParams(
      `SET XACT_ABORT ON;
       BEGIN TRAN;

       DECLARE @new_limit decimal(5,1) = CAST(@limite_horas_dobles_periodo AS decimal(5,1));
       DECLARE @new_cap   decimal(4,1) = CAST(@tope_horas_dia AS decimal(4,1));
       DECLARE @updated_at datetime2(0) = CAST(@updated_at_text AS datetime2(0));
       DECLARE @previous_limit decimal(5,1), @previous_cap decimal(4,1), @has_row bit = 0;

       SELECT @previous_limit = limite_horas_dobles_periodo,
              @previous_cap   = tope_horas_dia,
              @has_row        = 1
         FROM [CentroPodologico].[payroll].[overtime_settings] WITH (UPDLOCK, HOLDLOCK)
        WHERE id_empresa = @id_empresa;

       IF @has_row = 1 AND @previous_limit = @new_limit AND @previous_cap = @new_cap
       BEGIN
         COMMIT;
         RETURN;
       END

       IF @has_row = 1
         UPDATE [CentroPodologico].[payroll].[overtime_settings]
            SET limite_horas_dobles_periodo = @new_limit,
                tope_horas_dia              = @new_cap,
                updated_by                  = @updated_by,
                updated_at                  = @updated_at
          WHERE id_empresa = @id_empresa;
       ELSE
         INSERT INTO [CentroPodologico].[payroll].[overtime_settings]
           (id_empresa, limite_horas_dobles_periodo, tope_horas_dia, updated_by, updated_at)
         VALUES (@id_empresa, @new_limit, @new_cap, @updated_by, @updated_at);

       INSERT INTO [CentroPodologico].[payroll].[overtime_settings_log]
         (id_empresa, limite_horas_dobles_periodo_anterior, limite_horas_dobles_periodo_nuevo,
          tope_horas_dia_anterior, tope_horas_dia_nuevo, updated_by, updated_at)
       VALUES
         (@id_empresa, @previous_limit, @new_limit, @previous_cap, @new_cap, @updated_by, @updated_at);

       COMMIT;`,
      {
        id_empresa,
        limite_horas_dobles_periodo,
        tope_horas_dia,
        updated_by: id_user,
        updated_at_text: buildDate(new Date()),
      },
    );

    revalidatePath(OVERTIME_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("updateOvertimeSettings", error);
    return { ok: false, message: "No se pudo guardar la configuración de horas extra" };
  }
}
