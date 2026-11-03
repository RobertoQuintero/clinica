"use server";

import db from "@/database/connection";
import { ActionResult, assertPayrollAccess } from "@/lib/payroll/access";
import {
  createPendingDayPaymentsSchema,
  deletePendingDayPaymentSchema,
} from "@/lib/payroll/pendingDaysSchemas";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";

const PENDING_DAYS_PATH = "/dashboard/nomina/dias-pendientes";

function revalidatePayrollPaths() {
  revalidatePath(PENDING_DAYS_PATH);
  revalidatePath("/dashboard/nomina/procesar");
}

const PENDING_DAY_PERIOD_NOT_WRITABLE_MARKER = "PENDING_DAY_PERIOD_NOT_WRITABLE";
const PENDING_DAY_EMPLOYEE_NOT_ELIGIBLE_MARKER = "PENDING_DAY_EMPLOYEE_NOT_ELIGIBLE";
const PENDING_DAY_DATE_OUT_OF_RANGE_MARKER = "PENDING_DAY_DATE_OUT_OF_RANGE";
const PENDING_DAY_ALREADY_CAPTURED_MARKER = "PENDING_DAY_ALREADY_CAPTURED";

/** Traduce los errores de SQL Server de la captura/borrado de días pendientes a un mensaje en español. */
function describePendingDayWriteError(error: unknown): string {
  const sqlError = error as { message?: string; number?: number };
  if (sqlError.message?.includes(PENDING_DAY_ALREADY_CAPTURED_MARKER)) {
    const fechas = sqlError.message.split(`${PENDING_DAY_ALREADY_CAPTURED_MARKER}:`)[1]?.trim() ?? "";
    return `Estos días ya están capturados para el empleado: ${fechas}`;
  }
  if (sqlError.message?.includes(PENDING_DAY_DATE_OUT_OF_RANGE_MARKER)) {
    return "La fecha no puede ser posterior al fin del periodo ni anterior al ingreso del empleado";
  }
  if (sqlError.message?.includes(PENDING_DAY_PERIOD_NOT_WRITABLE_MARKER)) {
    return "El periodo no existe en esta sucursal, no es ordinario o ya no admite cambios";
  }
  if (sqlError.message?.includes(PENDING_DAY_EMPLOYEE_NOT_ELIGIBLE_MARKER)) {
    return "El empleado no existe en esta sucursal o no está activo";
  }
  if (sqlError.number === 2627 || sqlError.number === 2601 || sqlError.number === 1205) {
    return "Otro usuario modificó esta captura al mismo tiempo. Intenta de nuevo";
  }
  return "No se pudo guardar la captura de días pendientes";
}

/**
 * Captura un rango de fechas (una fila por día) para un empleado, en un solo batch: el periodo se lee con
 * UPDLOCK/HOLDLOCK validando sucursal, que sea ordinario y que admita cambios (estatus 1 o 2); la fecha final no
 * puede ser posterior a `fecha_fin` del periodo ni la inicial anterior a `fecha_ingreso` del empleado; si alguna
 * fecha del rango ya tiene captura (de este periodo o de otro) no se guarda ninguna. El rango se expande en SQL
 * con una CTE recursiva para que el INSERT sea una sola instrucción atómica.
 */
export async function createPendingDayPayments(input: unknown): Promise<ActionResult<number>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal, id_user } = access.data;

  const parsed = createPendingDayPaymentsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { id_period, id_empleado, fecha_desde, fecha_hasta, tarifa_operativa, tarifa_fiscal, motivo } = parsed.data;

  try {
    const rows = await db.queryParams(
      `SET XACT_ABORT ON;
       BEGIN TRAN;

       DECLARE @status tinyint, @fecha_fin date, @tipo_periodo char(1);
       SELECT @status = status, @fecha_fin = fecha_fin, @tipo_periodo = tipo_periodo
         FROM [CentroPodologico].[payroll].[periods] WITH (UPDLOCK, HOLDLOCK)
        WHERE id_period = @id_period AND id_sucursal = @id_sucursal;

       IF @status IS NULL OR @tipo_periodo <> 'O' OR @status NOT IN (1, 2)
         THROW 50097, '${PENDING_DAY_PERIOD_NOT_WRITABLE_MARKER}', 1;

       DECLARE @fecha_ingreso date;
       SELECT @fecha_ingreso = fecha_ingreso
         FROM [CentroPodologico].[RH].[empleados]
        WHERE id_empleado = @id_empleado AND id_sucursal = @id_sucursal AND status = 1 AND activo = 1;

       IF @fecha_ingreso IS NULL
         THROW 50097, '${PENDING_DAY_EMPLOYEE_NOT_ELIGIBLE_MARKER}', 1;

       IF CAST(@fecha_hasta AS date) > @fecha_fin OR CAST(@fecha_desde AS date) < @fecha_ingreso
         THROW 50097, '${PENDING_DAY_DATE_OUT_OF_RANGE_MARKER}', 1;

       DECLARE @conflicts nvarchar(max);
       SELECT @conflicts = STRING_AGG(CONVERT(varchar(10), fecha, 120), ', ') WITHIN GROUP (ORDER BY fecha)
         FROM [CentroPodologico].[payroll].[pending_day_payments]
        WHERE id_empleado = @id_empleado
          AND fecha BETWEEN CAST(@fecha_desde AS date) AND CAST(@fecha_hasta AS date);

       IF @conflicts IS NOT NULL
         THROW 50097, CONCAT('${PENDING_DAY_ALREADY_CAPTURED_MARKER}:', @conflicts), 1;

       ;WITH dates AS (
         SELECT CAST(@fecha_desde AS date) AS fecha
         UNION ALL
         SELECT DATEADD(day, 1, fecha) FROM dates WHERE fecha < CAST(@fecha_hasta AS date)
       )
       INSERT INTO [CentroPodologico].[payroll].[pending_day_payments]
         (id_period, id_empleado, fecha, tarifa_operativa, tarifa_fiscal, motivo, created_by, created_at)
       SELECT @id_period, @id_empleado, fecha, @tarifa_operativa, @tarifa_fiscal, @motivo, @created_by,
              CAST(@created_at AS datetime2(0))
         FROM dates
        OPTION (MAXRECURSION 0);

       DECLARE @inserted int = @@ROWCOUNT;

       COMMIT;

       SELECT @inserted AS inserted;`,
      {
        id_period,
        id_sucursal,
        id_empleado,
        fecha_desde,
        fecha_hasta,
        tarifa_operativa,
        tarifa_fiscal,
        motivo,
        created_by: id_user,
        created_at: buildDate(new Date()),
      },
    );

    revalidatePayrollPaths();
    return { ok: true, data: Number((rows[0] as { inserted: number } | undefined)?.inserted ?? 0) };
  } catch (error) {
    console.error("createPendingDayPayments", error);
    return { ok: false, message: describePendingDayWriteError(error) };
  }
}

/**
 * Borra una captura (DELETE físico) mientras su periodo esté en estatus 1 o 2; el periodo se lee con
 * UPDLOCK/HOLDLOCK como en la captura. Borrar una fila que ya no existe o que no es del periodo dado no es error.
 */
export async function deletePendingDayPayment(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal } = access.data;

  const parsed = deletePendingDayPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { id_pending_day_payment, id_period } = parsed.data;

  try {
    await db.queryParams(
      `SET XACT_ABORT ON;
       BEGIN TRAN;

       DECLARE @status tinyint, @tipo_periodo char(1);
       SELECT @status = status, @tipo_periodo = tipo_periodo
         FROM [CentroPodologico].[payroll].[periods] WITH (UPDLOCK, HOLDLOCK)
        WHERE id_period = @id_period AND id_sucursal = @id_sucursal;

       IF @status IS NULL OR @tipo_periodo <> 'O' OR @status NOT IN (1, 2)
         THROW 50097, '${PENDING_DAY_PERIOD_NOT_WRITABLE_MARKER}', 1;

       DELETE FROM [CentroPodologico].[payroll].[pending_day_payments]
        WHERE id_pending_day_payment = @id_pending_day_payment AND id_period = @id_period;

       COMMIT;`,
      { id_period, id_sucursal, id_pending_day_payment },
    );

    revalidatePayrollPaths();
    return { ok: true, data: null };
  } catch (error) {
    console.error("deletePendingDayPayment", error);
    return { ok: false, message: describePendingDayWriteError(error) };
  }
}
