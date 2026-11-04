"use server";

import db from "@/database/connection";
import {
  IPendingDayPaymentRow,
  IPendingDaysActiveEmployee,
  IPendingDaysPagePayload,
} from "@/interfaces/payroll_pending_days";
import { ActionResult, assertPayrollAccess } from "@/lib/payroll/access";
import { EMPLOYEE_FULL_NAME_SQL } from "@/lib/payroll/employeeName";
import { normalizeSearchText } from "@/lib/payroll/listHelpers";
import { loadPendingDaysNotCovered } from "@/lib/payroll/pendingDaysNotCovered";
import { isPendingDaysRecalculationNeeded } from "@/lib/payroll/pendingDaysRecalculation";
import { resolvePeriod } from "@/lib/payroll/period";
import { sumPendingDays } from "@/lib/payroll/pendingDaysPay";
import {
  createPendingDayPaymentsSchema,
  deletePendingDayPaymentSchema,
  pendingDaysPageFiltersSchema,
} from "@/lib/payroll/pendingDaysSchemas";
import { PENDING_DAYS_PAGE_SIZE } from "@/lib/payroll/constants";
import { buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";

const PENDING_DAYS_PATH = "/dashboard/nomina/dias-pendientes";

function revalidatePayrollPaths() {
  revalidatePath(PENDING_DAYS_PATH);
  revalidatePath("/dashboard/nomina/procesar");
}

type IPendingDayPaymentSqlRow = Omit<IPendingDayPaymentRow, "sin_salario_operativa" | "sin_salario_fiscal"> & {
  sin_salario_operativa: number;
  sin_salario_fiscal: number;
};

/**
 * Lista de capturas del periodo (empleado, fecha, tarifas, motivo, autor), con el periodo de la fecha (si
 * cae dentro de uno ordinario de la sucursal) y el periodo que ya la pagó (si está en el desglose).
 * El resumen se calcula sin el buscador y después se aplican la búsqueda y la paginación.
 */
export async function getPendingDaysPage(filters: unknown): Promise<ActionResult<IPendingDaysPagePayload>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal } = access.data;

  const parsedFilters = pendingDaysPageFiltersSchema.safeParse(filters);
  if (!parsedFilters.success) {
    return { ok: false, message: parsedFilters.error.issues[0]?.message ?? "Filtros inválidos" };
  }
  const { idPeriod, search: rawSearch, page } = parsedFilters.data;

  try {
    const [period, periodOptions, activeEmployees] = await Promise.all([
      resolvePeriod(id_sucursal, idPeriod, { ordinaryOnly: true }),
      db.queryParams(
        `SELECT p.id_period, p.codigo,
                CONVERT(varchar(10), p.fecha_inicio, 120) AS fecha_inicio,
                CONVERT(varchar(10), p.fecha_fin, 120)    AS fecha_fin,
                p.status
           FROM [CentroPodologico].[payroll].[periods] p
          WHERE p.id_sucursal = @id_sucursal AND p.tipo_periodo = 'O'
          ORDER BY p.fecha_inicio DESC, p.id_period DESC`,
        { id_sucursal },
      ),
      db.queryParams(
        `SELECT e.id_empleado, e.codigo_empleado, ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo,
                CONVERT(varchar(10), e.fecha_ingreso, 120) AS fecha_ingreso,
                ISNULL(e.salario_diario, 0)        AS salario_diario,
                ISNULL(e.salario_diario_fiscal, 0) AS salario_diario_fiscal
           FROM [CentroPodologico].[RH].[empleados] e
          WHERE e.status = 1 AND e.activo = 1 AND e.id_sucursal = @id_sucursal
          ORDER BY e.apellido_paterno, e.apellido_materno, e.nombre, e.id_empleado`,
        { id_sucursal },
      ),
    ]);

    const emptyPayload: IPendingDaysPagePayload = {
      period,
      periodOptions: periodOptions as IPendingDaysPagePayload["periodOptions"],
      canCapture: false,
      rows: [],
      totalRows: 0,
      summary: { capturedDays: 0, totalOperativa: 0, totalFiscal: 0 },
      activeEmployees: activeEmployees as IPendingDaysActiveEmployee[],
      recalculationNeeded: false,
      notCovered: [],
    };
    if (!period) return { ok: true, data: emptyPayload };

    const [rawRowsResult, recalculationNeeded, notCovered] = await Promise.all([
      db.queryParams(
        `SELECT pdp.id_pending_day_payment, pdp.id_period, pdp.id_empleado,
              e.codigo_empleado, ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo,
              CONVERT(varchar(10), pdp.fecha, 120) AS fecha,
              pdp.tarifa_operativa, pdp.tarifa_fiscal, pdp.motivo,
              CONVERT(varchar(19), pdp.created_at, 120) AS created_at,
              ISNULL(cu.nombre, '') AS capturado_por,
              p2.codigo AS periodo_de_la_fecha, p2.status AS estatus_de_la_fecha,
              paid.pagado_en,
              CASE WHEN ISNULL(e.salario_diario, 0) <= 0 THEN 1 ELSE 0 END AS sin_salario_operativa,
              CASE WHEN ISNULL(e.salario_diario_fiscal, 0) <= 0 THEN 1 ELSE 0 END AS sin_salario_fiscal
         FROM [CentroPodologico].[payroll].[pending_day_payments] pdp
         JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = pdp.id_empleado
         LEFT JOIN [CentroPodologico].[dbo].[users] cu ON cu.id_user = pdp.created_by
         LEFT JOIN [CentroPodologico].[payroll].[periods] p2
           ON p2.id_sucursal = @id_sucursal AND p2.tipo_periodo = 'O'
          AND pdp.fecha BETWEEN p2.fecha_inicio AND p2.fecha_fin
         LEFT JOIN (
           SELECT pepd.id_empleado, pepd.fecha, MIN(p3.codigo) AS pagado_en
             FROM [CentroPodologico].[payroll].[period_employee_pending_days] pepd
             JOIN [CentroPodologico].[payroll].[period_employees] pe3 ON pe3.id_period_employee = pepd.id_period_employee
             JOIN [CentroPodologico].[payroll].[periods] p3 ON p3.id_period = pe3.id_period
            GROUP BY pepd.id_empleado, pepd.fecha
         ) paid ON paid.id_empleado = pdp.id_empleado AND paid.fecha = pdp.fecha
        WHERE pdp.id_period = @id_period
        ORDER BY pdp.fecha DESC, nombre_completo`,
        { id_sucursal, id_period: period.id_period },
      ),
      period.status === 2 ? isPendingDaysRecalculationNeeded(period.id_period) : Promise.resolve(false),
      loadPendingDaysNotCovered(period.id_period),
    ]);
    const rawRows = rawRowsResult as IPendingDayPaymentSqlRow[];

    const allRows: IPendingDayPaymentRow[] = rawRows.map((row) => ({
      ...row,
      sin_salario_operativa: Boolean(row.sin_salario_operativa),
      sin_salario_fiscal: Boolean(row.sin_salario_fiscal),
    }));

    const totals = sumPendingDays(allRows);

    const search = normalizeSearchText(rawSearch.trim());
    const filteredRows = allRows.filter(
      (row) =>
        search === "" ||
        normalizeSearchText(row.nombre_completo).includes(search) ||
        normalizeSearchText(row.codigo_empleado).includes(search),
    );

    const pageStart = (page - 1) * PENDING_DAYS_PAGE_SIZE;

    return {
      ok: true,
      data: {
        ...emptyPayload,
        canCapture: period.status === 1 || period.status === 2,
        rows: filteredRows.slice(pageStart, pageStart + PENDING_DAYS_PAGE_SIZE),
        totalRows: filteredRows.length,
        summary: { capturedDays: allRows.length, totalOperativa: totals.totalOperativa, totalFiscal: totals.totalFiscal },
        recalculationNeeded,
        notCovered,
      },
    };
  } catch (error) {
    console.error("getPendingDaysPage", error);
    return { ok: false, message: "No se pudieron cargar los días pendientes de pago" };
  }
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

       DECLARE @conflicts_message nvarchar(max);
       IF @conflicts IS NOT NULL
       BEGIN
         SET @conflicts_message = CONCAT('${PENDING_DAY_ALREADY_CAPTURED_MARKER}:', @conflicts);
         THROW 50097, @conflicts_message, 1;
       END

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
