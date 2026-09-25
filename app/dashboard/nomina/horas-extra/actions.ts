"use server";

import db, { ITransactionClient } from "@/database/connection";
import { IAttendanceEvent } from "@/interfaces/asistencia";
import { IScheduleDay } from "@/interfaces/employee_schedule";
import {
  IOvertimeDayRow,
  IOvertimeFilters,
  IOvertimePage,
  IOvertimeSettings,
  IOvertimeSettingsLogEntry,
  OvertimeDecisionStatus,
} from "@/interfaces/payroll_overtime";
import { ActionResult, assertPayrollAccess } from "@/lib/payroll/access";
import { OVERTIME_PAGE_SIZE } from "@/lib/payroll/constants";
import { ELIGIBLE_OPERATIVE_EMPLOYEE_CONDITIONS } from "@/lib/payroll/eligibleEmployees";
import { EMPLOYEE_FULL_NAME_SQL } from "@/lib/payroll/employeeName";
import { describeOvertimeDay, detectEmployeeOvertime } from "@/lib/payroll/overtimeDetection";
import { resolvePeriod } from "@/lib/payroll/period";
import { clearOvertimeDecisionSchema, decideOvertimeDaySchema, overtimeSettingsSchema } from "@/lib/payroll/schemas";
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
              ISNULL(u.nombre, '')                       AS updated_by_name,
              CONVERT(varchar(19), s.updated_at, 120)      AS updated_at
         FROM [CentroPodologico].[payroll].[overtime_settings] s
         LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = s.updated_by
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

interface IOvertimeDayTarget {
  id_period: number;
  id_empleado: number;
  fecha: string;
}

type OvertimeWriteCheck = { ok: true } | { ok: false; message: string };

/**
 * Dentro de la transacción: valida que el periodo sea de la sucursal activa y admita cambios (estatus 1 o 2),
 * que la fecha caiga en su rango y que el empleado sea elegible ese día. El periodo se lee con
 * UPDLOCK/HOLDLOCK para que un cambio de estatus no se cuele a mitad de la escritura.
 */
async function validateOvertimeDayTarget(
  transaction: ITransactionClient,
  idSucursal: number,
  target: IOvertimeDayTarget,
): Promise<OvertimeWriteCheck> {
  const periodRows = await transaction.queryParams(
    `SELECT id_payment_period, status,
            CONVERT(varchar(10), fecha_inicio, 120) AS fecha_inicio,
            CONVERT(varchar(10), fecha_fin, 120)    AS fecha_fin
       FROM [CentroPodologico].[payroll].[periods] WITH (UPDLOCK, HOLDLOCK)
      WHERE id_period = @id_period AND id_sucursal = @id_sucursal`,
    { id_period: target.id_period, id_sucursal: idSucursal },
  );
  const period = periodRows[0] as
    | { id_payment_period: number; status: number; fecha_inicio: string; fecha_fin: string }
    | undefined;
  if (!period) return { ok: false, message: "El periodo no existe" };
  if (period.status !== 1 && period.status !== 2) {
    return { ok: false, message: "El periodo ya no admite cambios" };
  }
  if (target.fecha < period.fecha_inicio || target.fecha > period.fecha_fin) {
    return { ok: false, message: "La fecha está fuera del periodo" };
  }

  // Un día anterior a la fecha de ingreso tampoco es revisable (spec 60, "Quién se revisa").
  const employeeRows = await transaction.queryParams(
    `SELECT e.id_empleado
       FROM [CentroPodologico].[RH].[empleados] e
      WHERE e.id_empleado = @id_empleado
        AND ${ELIGIBLE_OPERATIVE_EMPLOYEE_CONDITIONS}
        AND e.fecha_ingreso <= CAST(@fecha AS date)`,
    {
      id_empleado: target.id_empleado,
      id_sucursal: idSucursal,
      id_payment_period: period.id_payment_period,
      fecha_fin: period.fecha_fin,
      fecha: target.fecha,
    },
  );
  if (employeeRows.length === 0) {
    return { ok: false, message: "El empleado no es elegible para este periodo en esa fecha" };
  }
  return { ok: true };
}

/** Horas extra que el servidor detecta para un empleado en un día; 0 si no hay extra ni checada incompleta. */
async function detectOvertimeHoursForDay(
  transaction: ITransactionClient,
  idEmpleado: number,
  fecha: string,
): Promise<number> {
  const scheduleRows = (await transaction.queryParams(
    `SELECT [dia_semana],
            CONVERT(varchar(5), [hora_entrada_1], 108) AS hora_entrada_1,
            CONVERT(varchar(5), [hora_salida_1],  108) AS hora_salida_1,
            CONVERT(varchar(5), [hora_entrada_2], 108) AS hora_entrada_2,
            CONVERT(varchar(5), [hora_salida_2],  108) AS hora_salida_2
       FROM [CentroPodologico].[RH].[empleado_horarios]
      WHERE [id_empleado] = @id_empleado`,
    { id_empleado: idEmpleado },
  )) as IScheduleDay[];

  const events = (await transaction.queryParams(
    `SELECT a.[id_asistencia], a.[id_empleado], a.[id_checador],
            CONVERT(varchar(19), a.[fecha_hora], 120) AS fecha_hora,
            a.[tipo], a.[identificador_origen],
            CONVERT(varchar(19), a.[created_at], 120) AS created_at
       FROM [CentroPodologico].[RH].[asistencias] a
      WHERE a.[id_empleado] = @id_empleado
        AND a.[fecha_hora] >= CAST(@fecha AS date)
        AND a.[fecha_hora] <  DATEADD(day, 1, CAST(@fecha AS date))
      ORDER BY a.[fecha_hora] ASC`,
    { id_empleado: idEmpleado, fecha },
  )) as IAttendanceEvent[];

  const detections = detectEmployeeOvertime(scheduleRows, events, fecha, fecha);
  return detections[0]?.detectedHours ?? 0;
}

/**
 * Autoriza (con horas) o rechaza las horas extra de un empleado en un día, sobrescribiendo la decisión previa.
 * `horas_detectadas` siempre lo recalcula el servidor; cualquier valor que mande el cliente se ignora.
 */
export async function decideOvertimeDay(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal, id_user, id_empresa } = access.data;

  const parsed = decideOvertimeDaySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { id_period, id_empleado, fecha, decision, horas_autorizadas, comentario } = parsed.data;

  try {
    const result = await db.transaction(async (transaction): Promise<OvertimeWriteCheck> => {
      const target = await validateOvertimeDayTarget(transaction, id_sucursal, { id_period, id_empleado, fecha });
      if (!target.ok) return target;

      const authorizedHours = decision === "authorized" ? (horas_autorizadas ?? null) : null;
      if (authorizedHours !== null) {
        const settingsRows = await transaction.queryParams(
          `SELECT CAST(tope_horas_dia AS float) AS tope_horas_dia
             FROM [CentroPodologico].[payroll].[overtime_settings]
            WHERE id_empresa = @id_empresa`,
          { id_empresa },
        );
        const dailyCap = (settingsRows[0] as { tope_horas_dia: number } | undefined)?.tope_horas_dia;
        if (dailyCap === undefined) {
          return { ok: false, message: "Falta la configuración de horas extra de la empresa" };
        }
        if (authorizedHours > dailyCap) {
          return { ok: false, message: `Máximo ${dailyCap} h por día` };
        }
      }

      const detectedHours = await detectOvertimeHoursForDay(transaction, id_empleado, fecha);

      await transaction.queryParams(
        `IF EXISTS (SELECT 1 FROM [CentroPodologico].[payroll].[overtime_authorizations] WITH (UPDLOCK, HOLDLOCK)
                     WHERE id_empleado = @id_empleado AND fecha = CAST(@fecha AS date))
           UPDATE [CentroPodologico].[payroll].[overtime_authorizations]
              SET estado            = @estado,
                  horas_autorizadas = CAST(@horas_autorizadas AS decimal(4,1)),
                  horas_detectadas  = CAST(@horas_detectadas AS decimal(4,1)),
                  comentario        = @comentario,
                  decided_by        = @decided_by,
                  decided_at        = CAST(@decided_at AS datetime2(0))
            WHERE id_empleado = @id_empleado AND fecha = CAST(@fecha AS date)
         ELSE
           INSERT INTO [CentroPodologico].[payroll].[overtime_authorizations]
             (id_empleado, fecha, estado, horas_autorizadas, horas_detectadas, comentario, decided_by, decided_at)
           VALUES (@id_empleado, CAST(@fecha AS date), @estado, CAST(@horas_autorizadas AS decimal(4,1)),
                   CAST(@horas_detectadas AS decimal(4,1)), @comentario, @decided_by, CAST(@decided_at AS datetime2(0)))`,
        {
          id_empleado,
          fecha,
          estado: decision === "authorized" ? "A" : "R",
          horas_autorizadas: authorizedHours,
          horas_detectadas: detectedHours,
          comentario: comentario ? comentario : null,
          decided_by: id_user,
          decided_at: buildDate(new Date()),
        },
      );
      return { ok: true };
    });

    if (!result.ok) return result;
    revalidatePath(OVERTIME_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("decideOvertimeDay", error);
    return { ok: false, message: "No se pudo guardar la decisión de horas extra" };
  }
}

/** Vuelve un día a "Pendiente": borra la decisión con las mismas validaciones de periodo que decideOvertimeDay. */
export async function clearOvertimeDecision(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal } = access.data;

  const parsed = clearOvertimeDecisionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const result = await db.transaction(async (transaction): Promise<OvertimeWriteCheck> => {
      const target = await validateOvertimeDayTarget(transaction, id_sucursal, parsed.data);
      if (!target.ok) return target;

      await transaction.queryParams(
        `DELETE FROM [CentroPodologico].[payroll].[overtime_authorizations]
          WHERE id_empleado = @id_empleado AND fecha = CAST(@fecha AS date)`,
        { id_empleado: parsed.data.id_empleado, fecha: parsed.data.fecha },
      );
      return { ok: true };
    });

    if (!result.ok) return result;
    revalidatePath(OVERTIME_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("clearOvertimeDecision", error);
    return { ok: false, message: "No se pudo volver el día a pendiente" };
  }
}

interface IEligibleEmployeeRow {
  id_empleado: number;
  codigo_empleado: string;
  nombre_completo: string;
  fecha_ingreso: string;
}

interface IStoredDecisionRow {
  id_empleado: number;
  fecha: string;
  estado: "A" | "R";
  horas_autorizadas: number | null;
  horas_detectadas: number;
  comentario: string | null;
  decided_by_name: string;
  decided_at: string;
}

/** Minúsculas y sin acentos, para que la búsqueda por nombre sea tolerante como el LIKE de SQL Server. */
function normalizeSearchText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function groupByEmployee<T extends { id_empleado: number }>(rows: T[]): Map<number, T[]> {
  const rowsByEmployee = new Map<number, T[]>();
  for (const row of rows) {
    const employeeRows = rowsByEmployee.get(row.id_empleado);
    if (employeeRows) employeeRows.push(row);
    else rowsByEmployee.set(row.id_empleado, [row]);
  }
  return rowsByEmployee;
}

/**
 * Lista de horas extra de un periodo: detección en vivo por empleado y día unida con las decisiones guardadas.
 * Son cuatro SELECT en total (empleados, horarios, checadas y decisiones), no uno por empleado; el resumen
 * se calcula sin filtros y después se aplican el estado, la búsqueda y la paginación.
 */
export async function getOvertimePage(filters: IOvertimeFilters): Promise<ActionResult<IOvertimePage>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal, id_empresa } = access.data;

  try {
    const periodOptionsPromise = db.queryParams(
      `SELECT p.id_period, p.codigo,
              CONVERT(varchar(10), p.fecha_inicio, 120) AS fecha_inicio,
              CONVERT(varchar(10), p.fecha_fin, 120)    AS fecha_fin,
              p.status
         FROM [CentroPodologico].[payroll].[periods] p
        WHERE p.id_sucursal = @id_sucursal
        ORDER BY p.fecha_inicio DESC, p.id_period DESC`,
      { id_sucursal },
    );
    const settingsPromise = db.queryParams(
      `SELECT s.id_empresa,
              CAST(s.limite_horas_dobles_periodo AS float) AS limite_horas_dobles_periodo,
              CAST(s.tope_horas_dia AS float)              AS tope_horas_dia,
              s.updated_by,
              ISNULL(u.nombre, '')                       AS updated_by_name,
              CONVERT(varchar(19), s.updated_at, 120)      AS updated_at
         FROM [CentroPodologico].[payroll].[overtime_settings] s
         LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = s.updated_by
        WHERE s.id_empresa = @id_empresa`,
      { id_empresa },
    );
    const [period, periodOptions, settingsRows] = await Promise.all([
      resolvePeriod(id_sucursal, filters.idPeriod),
      periodOptionsPromise,
      settingsPromise,
    ]);

    const settings = (settingsRows[0] as IOvertimeSettings | undefined) ?? null;
    const emptyPage: IOvertimePage = {
      period,
      periodOptions: periodOptions as IOvertimePage["periodOptions"],
      canDecide: false,
      rows: [],
      totalRows: 0,
      summary: { pendingDays: 0, detectedHours: 0, authorizedHours: 0 },
      employeesWithoutSchedule: [],
      settings,
    };
    if (!period) return { ok: true, data: emptyPage };

    const periodParams = {
      id_sucursal,
      id_payment_period: period.id_payment_period,
      fecha_fin: period.fecha_fin,
      fecha_inicio: period.fecha_inicio,
    };

    const [employees, scheduleRows, eventRows, decisionRows] = await Promise.all([
      db.queryParams(
        `SELECT e.id_empleado, e.codigo_empleado, ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo,
                CONVERT(varchar(10), e.fecha_ingreso, 120) AS fecha_ingreso
           FROM [CentroPodologico].[RH].[empleados] e
          WHERE ${ELIGIBLE_OPERATIVE_EMPLOYEE_CONDITIONS}
          ORDER BY e.apellido_paterno, e.apellido_materno, e.nombre, e.id_empleado`,
        periodParams,
      ),
      db.queryParams(
        `SELECT h.[id_empleado], h.[dia_semana],
                CONVERT(varchar(5), h.[hora_entrada_1], 108) AS hora_entrada_1,
                CONVERT(varchar(5), h.[hora_salida_1],  108) AS hora_salida_1,
                CONVERT(varchar(5), h.[hora_entrada_2], 108) AS hora_entrada_2,
                CONVERT(varchar(5), h.[hora_salida_2],  108) AS hora_salida_2
           FROM [CentroPodologico].[RH].[empleado_horarios] h
           JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = h.id_empleado
          WHERE ${ELIGIBLE_OPERATIVE_EMPLOYEE_CONDITIONS}`,
        periodParams,
      ),
      db.queryParams(
        `SELECT a.[id_asistencia], a.[id_empleado], a.[id_checador],
                CONVERT(varchar(19), a.[fecha_hora], 120) AS fecha_hora,
                a.[tipo], a.[identificador_origen],
                CONVERT(varchar(19), a.[created_at], 120) AS created_at
           FROM [CentroPodologico].[RH].[asistencias] a
           JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = a.id_empleado
          WHERE ${ELIGIBLE_OPERATIVE_EMPLOYEE_CONDITIONS}
            AND a.[fecha_hora] >= CAST(@fecha_inicio AS date)
            AND a.[fecha_hora] <  DATEADD(day, 1, CAST(@fecha_fin AS date))
          ORDER BY a.[fecha_hora] ASC`,
        periodParams,
      ),
      db.queryParams(
        `SELECT oa.[id_empleado],
                CONVERT(varchar(10), oa.[fecha], 120) AS fecha,
                oa.[estado],
                CAST(oa.[horas_autorizadas] AS float) AS horas_autorizadas,
                CAST(oa.[horas_detectadas] AS float)  AS horas_detectadas,
                oa.[comentario],
                ISNULL(u.[nombre], '')                AS decided_by_name,
                CONVERT(varchar(19), oa.[decided_at], 120) AS decided_at
           FROM [CentroPodologico].[payroll].[overtime_authorizations] oa
           JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = oa.id_empleado
           LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = oa.decided_by
          WHERE ${ELIGIBLE_OPERATIVE_EMPLOYEE_CONDITIONS}
            AND oa.[fecha] BETWEEN CAST(@fecha_inicio AS date) AND CAST(@fecha_fin AS date)`,
        periodParams,
      ),
    ]);

    const scheduleByEmployee = new Map(
      [...groupByEmployee(scheduleRows as (IScheduleDay & { id_empleado: number })[])].map(
        ([idEmpleado, days]) => [idEmpleado, days as IScheduleDay[]],
      ),
    );
    const eventsByEmployee = groupByEmployee(eventRows as IAttendanceEvent[]);
    const decisionsByEmployee = groupByEmployee(decisionRows as IStoredDecisionRow[]);

    const allRows: IOvertimeDayRow[] = [];
    const employeesWithoutSchedule: IOvertimePage["employeesWithoutSchedule"] = [];

    for (const employee of employees as IEligibleEmployeeRow[]) {
      const schedule = scheduleByEmployee.get(employee.id_empleado) ?? [];
      if (schedule.length === 0) {
        employeesWithoutSchedule.push({
          id_empleado: employee.id_empleado,
          nombre_completo: employee.nombre_completo,
        });
      }

      const employeeEvents = eventsByEmployee.get(employee.id_empleado) ?? [];
      const firstReviewedDate =
        employee.fecha_ingreso > period.fecha_inicio ? employee.fecha_ingreso : period.fecha_inicio;
      const detectionsByDate = new Map(
        detectEmployeeOvertime(schedule, employeeEvents, firstReviewedDate, period.fecha_fin).map(
          (detection) => [detection.fecha, detection],
        ),
      );
      const decisionsByDate = new Map(
        (decisionsByEmployee.get(employee.id_empleado) ?? []).map((decision) => [decision.fecha, decision]),
      );

      const listedDates = new Set([...detectionsByDate.keys(), ...decisionsByDate.keys()]);
      for (const fecha of [...listedDates].sort()) {
        // Un día solo con decisión (su detección hoy es 0) se describe igual, para mostrar horario y checadas.
        const detection = detectionsByDate.get(fecha) ?? describeOvertimeDay(schedule, employeeEvents, fecha);
        const decision = decisionsByDate.get(fecha);
        const status: OvertimeDecisionStatus = !decision
          ? "pending"
          : decision.estado === "A"
            ? "authorized"
            : "rejected";
        allRows.push({
          ...detection,
          id_empleado: employee.id_empleado,
          codigo_empleado: employee.codigo_empleado,
          nombre_completo: employee.nombre_completo,
          status,
          authorizedHours: decision?.horas_autorizadas ?? null,
          detectedHoursAtDecision: decision?.horas_detectadas ?? null,
          comentario: decision?.comentario ?? null,
          decided_by_name: decision?.decided_by_name ?? null,
          decided_at: decision?.decided_at ?? null,
        });
      }
    }

    // Resumen del periodo completo: no cambia con el filtro de estado ni con la búsqueda.
    const summary = {
      pendingDays: allRows.filter((row) => row.status === "pending").length,
      detectedHours: allRows.reduce((total, row) => total + row.detectedHours, 0),
      authorizedHours: allRows.reduce((total, row) => total + (row.authorizedHours ?? 0), 0),
    };

    const search = normalizeSearchText(filters.search.trim());
    const filteredRows = allRows.filter(
      (row) =>
        (filters.status === "all" || row.status === filters.status) &&
        (search === "" ||
          normalizeSearchText(row.nombre_completo).includes(search) ||
          normalizeSearchText(row.codigo_empleado).includes(search)),
    );

    const pageNumber = Math.max(1, Math.floor(filters.page) || 1);
    const pageStart = (pageNumber - 1) * OVERTIME_PAGE_SIZE;

    return {
      ok: true,
      data: {
        ...emptyPage,
        canDecide: period.status === 1 || period.status === 2,
        rows: filteredRows.slice(pageStart, pageStart + OVERTIME_PAGE_SIZE),
        totalRows: filteredRows.length,
        summary,
        employeesWithoutSchedule,
      },
    };
  } catch (error) {
    console.error("getOvertimePage", error);
    return { ok: false, message: "No se pudieron cargar las horas extra" };
  }
}
