"use server";

import db, { ITransactionClient } from "@/database/connection";
import {
  ILatenessDayRow,
  ILatenessEmployeeSummary,
  ILatenessFilters,
  ILatenessFrequencyOption,
  ILatenessPage,
  ILatenessSettings,
  ILatenessSettingsLogEntry,
  ILatenessTier,
  LatenessStatus,
} from "@/interfaces/payroll_lateness";
import { ActionResult, assertPayrollAccess } from "@/lib/payroll/access";
import { LATENESS_PAGE_SIZE, PAYROLL_FREQUENCY_LETTER_BY_SAT_KEY } from "@/lib/payroll/constants";
import {
  loadDiscountedDays,
  loadFirstEntries,
  loadJustifications,
  loadReviewedEmployees,
  loadScheduleByEmployee,
} from "@/lib/payroll/incidentSources";
import {
  JustificationWriteCheck,
  upsertJustification,
  validateJustificationTarget,
} from "@/lib/payroll/justificationWrites";
import { isLatenessRecalculationNeeded } from "@/lib/payroll/latenessRecalculation";
import {
  calculateLatenessDiscountDays,
  calculateLatenessMinutes,
  detectEmployeeLateness,
} from "@/lib/payroll/latenessDetection";
import { buildDiscountedCodesByDay, groupByEmployee, normalizeSearchText } from "@/lib/payroll/listHelpers";
import { weekdayOfDate } from "@/lib/payroll/overtimeDetection";
import { resolvePeriod } from "@/lib/payroll/period";
import {
  clearLatenessJustificationSchema,
  justifyLatenessSchema,
  latenessPageFiltersSchema,
  markLatenessNotApplicableSchema,
  updateLatenessSettingsSchema,
} from "@/lib/payroll/schemas";
import { addZeroToday, buildDate } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";

const LATENESS_PATH = "/dashboard/nomina/retardos";
const LATENESS_SETTINGS_LOG_LIMIT = 20;

const STATUS_BY_STORED_STATE: Record<"J" | "N", LatenessStatus> = {
  J: "justified",
  N: "not_applicable",
};

/** Escalones "anteriores"/"nuevos" de la bitácora: JSON guardado como texto, o null si no había configuración. */
function parseStoredTiers(storedTiers: string | null): ILatenessTier[] | null {
  if (storedTiers === null) return null;
  try {
    return JSON.parse(storedTiers) as ILatenessTier[];
  } catch {
    return [];
  }
}

/** Configuración de retardos de la empresa (con sus escalones), o null si no hay fila. */
async function loadLatenessSettings(idEmpresa: number): Promise<ILatenessSettings | null> {
  const [settingsRows, tierRows] = await Promise.all([
    db.queryParams(
      `SELECT s.id_empresa, s.tolerancia_minutos, s.minutos_retardo_grave,
              CAST(s.dias_descuento_retardo_grave AS float) AS dias_descuento_retardo_grave,
              ISNULL(u.nombre, '')                          AS updated_by_name,
              CONVERT(varchar(19), s.updated_at, 120)       AS updated_at
         FROM [CentroPodologico].[payroll].[lateness_settings] s
         LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = s.updated_by
        WHERE s.id_empresa = @id_empresa`,
      { id_empresa: idEmpresa },
    ),
    db.queryParams(
      `SELECT t.id_payment_period, t.retardos, CAST(t.dias_descuento AS float) AS dias_descuento
         FROM [CentroPodologico].[payroll].[lateness_tiers] t
        WHERE t.id_empresa = @id_empresa
        ORDER BY t.id_payment_period, t.retardos`,
      { id_empresa: idEmpresa },
    ),
  ]);

  const settingsRow = settingsRows[0] as Omit<ILatenessSettings, "tiers"> | undefined;
  if (!settingsRow) return null;
  return {
    ...settingsRow,
    tolerancia_minutos: Number(settingsRow.tolerancia_minutos),
    minutos_retardo_grave: Number(settingsRow.minutos_retardo_grave),
    dias_descuento_retardo_grave: Number(settingsRow.dias_descuento_retardo_grave),
    tiers: (tierRows as ILatenessTier[]).map((tier) => ({
      id_payment_period: Number(tier.id_payment_period),
      retardos: Number(tier.retardos),
      dias_descuento: Number(tier.dias_descuento),
    })),
  };
}

/** Las últimas 20 entradas de la bitácora de la empresa, de la más reciente a la más antigua. */
export async function getLatenessSettingsLog(): Promise<ActionResult<ILatenessSettingsLogEntry[]>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  try {
    const rows = await db.queryParams(
      `SELECT TOP (@limit)
              l.id_log,
              l.tolerancia_minutos_anterior, l.tolerancia_minutos_nuevo,
              l.minutos_retardo_grave_anterior, l.minutos_retardo_grave_nuevo,
              CAST(l.dias_descuento_retardo_grave_anterior AS float) AS dias_descuento_retardo_grave_anterior,
              CAST(l.dias_descuento_retardo_grave_nuevo AS float)    AS dias_descuento_retardo_grave_nuevo,
              l.escalones_anteriores, l.escalones_nuevos,
              ISNULL(u.nombre, '')                                   AS updated_by_name,
              CONVERT(varchar(19), l.updated_at, 120)                AS updated_at
         FROM [CentroPodologico].[payroll].[lateness_settings_log] l
         LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = l.updated_by
        WHERE l.id_empresa = @id_empresa
        ORDER BY l.updated_at DESC, l.id_log DESC`,
      { id_empresa: access.data.id_empresa, limit: LATENESS_SETTINGS_LOG_LIMIT },
    );
    return {
      ok: true,
      data: (
        rows as (Omit<ILatenessSettingsLogEntry, "escalones_anteriores" | "escalones_nuevos"> & {
          escalones_anteriores: string | null;
          escalones_nuevos: string;
        })[]
      ).map((row) => ({
        ...row,
        escalones_anteriores: parseStoredTiers(row.escalones_anteriores),
        escalones_nuevos: parseStoredTiers(row.escalones_nuevos) ?? [],
      })),
    };
  } catch (error) {
    console.error("getLatenessSettingsLog", error);
    return { ok: false, message: "No se pudo cargar la bitácora de cambios" };
  }
}

/**
 * Lista de retardos de un periodo (spec 63): detección en vivo por empleado con control de faltas, unida con
 * las justificaciones guardadas. Son seis SELECT en total (configuración con escalones, empleados, horarios,
 * primera entrada por día, justificaciones y retardos ya descontados); las tarjetas y el resumen por empleado
 * se calculan sin filtros y después se aplican estado, clasificación, búsqueda y paginación.
 */
export async function getLatenessPage(filters: ILatenessFilters): Promise<ActionResult<ILatenessPage>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal, id_empresa } = access.data;

  const parsedFilters = latenessPageFiltersSchema.safeParse(filters);
  if (!parsedFilters.success) {
    return { ok: false, message: parsedFilters.error.issues[0]?.message ?? "Filtros inválidos" };
  }
  const { idPeriod, status: statusFilter, classification: classificationFilter, search: rawSearch, page } =
    parsedFilters.data;

  try {
    const [period, periodOptions, settings, frequencyRows] = await Promise.all([
      resolvePeriod(id_sucursal, idPeriod),
      db.queryParams(
        `SELECT p.id_period, p.codigo,
                CONVERT(varchar(10), p.fecha_inicio, 120) AS fecha_inicio,
                CONVERT(varchar(10), p.fecha_fin, 120)    AS fecha_fin,
                p.status
           FROM [CentroPodologico].[payroll].[periods] p
          WHERE p.id_sucursal = @id_sucursal
          ORDER BY p.fecha_inicio DESC, p.id_period DESC`,
        { id_sucursal },
      ),
      loadLatenessSettings(id_empresa),
      db.query(
        `SELECT id_payment_period, clave_sat, description
           FROM [CentroPodologico].[RH].[payment_periods]
          WHERE status = 1
          ORDER BY id_payment_period`,
      ),
    ]);
    // Solo las frecuencias que Periodos ofrece (claves SAT con letra y regla de fechas definidas).
    const frequencyOptions: ILatenessFrequencyOption[] = (
      frequencyRows as (ILatenessFrequencyOption & { clave_sat: string })[]
    )
      .filter((row) => row.clave_sat in PAYROLL_FREQUENCY_LETTER_BY_SAT_KEY)
      .map((row) => ({ id_payment_period: row.id_payment_period, description: row.description }));

    const emptyPage: ILatenessPage = {
      period,
      periodOptions: periodOptions as ILatenessPage["periodOptions"],
      canDecide: false,
      settings,
      frequencyOptions,
      periodHasTiers: false,
      rows: [],
      totalRows: 0,
      summary: { severeUnjustified: 0, accumulableUnjustified: 0, justified: 0, notApplicable: 0 },
      employeeSummaries: [],
      employeesWithoutSchedule: [],
      recalculationNeeded: false,
    };
    // Sin periodo o sin configuración no hay tolerancia contra la cual detectar: la pantalla muestra el aviso.
    if (!period || !settings) return { ok: true, data: emptyPage };

    const periodTiers = settings.tiers.filter((tier) => tier.id_payment_period === period.id_payment_period);

    const [employees, scheduleByEmployee, firstEntryRows, justificationRows, discountedRows] = await Promise.all([
      loadReviewedEmployees(id_sucursal, period),
      loadScheduleByEmployee(id_sucursal, period),
      loadFirstEntries(id_sucursal, period),
      loadJustifications("lateness", id_sucursal, period),
      loadDiscountedDays("lateness", id_sucursal, period),
    ]);

    const firstEntriesByEmployee = groupByEmployee(firstEntryRows);
    const justificationsByEmployee = groupByEmployee(justificationRows);
    const discountedCodesByDay = buildDiscountedCodesByDay(discountedRows);

    // El día de hoy sí se evalúa (el retardo es definitivo en cuanto existe la entrada); los futuros no.
    const today = addZeroToday(new Date());
    const rangeEndInclusive = today < period.fecha_fin ? today : period.fecha_fin;

    const allRows: ILatenessDayRow[] = [];
    const employeeSummaries: ILatenessEmployeeSummary[] = [];
    const employeesWithoutSchedule: ILatenessPage["employeesWithoutSchedule"] = [];

    for (const employee of employees) {
      const schedule = scheduleByEmployee.get(employee.id_empleado) ?? [];
      if (schedule.length === 0) {
        employeesWithoutSchedule.push({
          id_empleado: employee.id_empleado,
          nombre_completo: employee.nombre_completo,
        });
        continue;
      }

      const rangeStart = employee.fecha_ingreso > period.fecha_inicio ? employee.fecha_ingreso : period.fecha_inicio;
      const firstEntryByDate = new Map(
        (firstEntriesByEmployee.get(employee.id_empleado) ?? []).map((row) => [row.fecha, row.hora_llegada]),
      );
      const justificationsByDate = new Map(
        (justificationsByEmployee.get(employee.id_empleado) ?? []).map((justification) => [
          justification.fecha,
          justification,
        ]),
      );

      const employeeRows: ILatenessDayRow[] = detectEmployeeLateness(
        schedule,
        firstEntryByDate,
        rangeStart,
        rangeEndInclusive,
        settings,
      ).map((lateness) => {
        const justification = justificationsByDate.get(lateness.fecha);
        return {
          ...lateness,
          id_empleado: employee.id_empleado,
          codigo_empleado: employee.codigo_empleado,
          nombre_completo: employee.nombre_completo,
          status: justification ? STATUS_BY_STORED_STATE[justification.estado] : "unjustified",
          url: justification?.url ?? null,
          mime_type: justification?.mime_type ?? null,
          comentario: justification?.comentario ?? null,
          decided_by_name: justification?.decided_by_name ?? null,
          decided_at: justification?.decided_at ?? null,
          discountedInPeriodCodes: discountedCodesByDay.get(`${employee.id_empleado}|${lateness.fecha}`) ?? [],
        };
      });
      allRows.push(...employeeRows);

      // Estimado antes del tope: solo cuentan los injustificados que ningún otro periodo ya descontó.
      const countableRows = employeeRows.filter(
        (row) =>
          row.status === "unjustified" && row.discountedInPeriodCodes.every((code) => code === period.codigo),
      );
      if (employeeRows.length > 0) {
        const severeCount = countableRows.filter((row) => row.classification === "severe").length;
        const accumulableCount = countableRows.length - severeCount;
        employeeSummaries.push({
          id_empleado: employee.id_empleado,
          nombre_completo: employee.nombre_completo,
          severeCount,
          accumulableCount,
          estimatedDays: calculateLatenessDiscountDays(
            severeCount,
            accumulableCount,
            settings.dias_descuento_retardo_grave,
            periodTiers,
          ),
        });
      }
    }

    // Tarjetas del periodo completo: no cambian con los filtros.
    const summary = {
      severeUnjustified: allRows.filter((row) => row.status === "unjustified" && row.classification === "severe")
        .length,
      accumulableUnjustified: allRows.filter(
        (row) => row.status === "unjustified" && row.classification === "accumulable",
      ).length,
      justified: allRows.filter((row) => row.status === "justified").length,
      notApplicable: allRows.filter((row) => row.status === "not_applicable").length,
    };

    const search = normalizeSearchText(rawSearch.trim());
    const filteredRows = allRows.filter(
      (row) =>
        (statusFilter === "all" || row.status === statusFilter) &&
        (classificationFilter === "all" || row.classification === classificationFilter) &&
        (search === "" ||
          normalizeSearchText(row.nombre_completo).includes(search) ||
          normalizeSearchText(row.codigo_empleado).includes(search)),
    );

    const recalculationNeeded = await isLatenessRecalculationNeeded(period.id_period);

    const pageStart = (page - 1) * LATENESS_PAGE_SIZE;

    return {
      ok: true,
      data: {
        ...emptyPage,
        canDecide: period.status === 1 || period.status === 2,
        periodHasTiers: periodTiers.length > 0,
        rows: filteredRows.slice(pageStart, pageStart + LATENESS_PAGE_SIZE),
        totalRows: filteredRows.length,
        summary,
        employeeSummaries,
        employeesWithoutSchedule,
        recalculationNeeded,
      },
    };
  } catch (error) {
    console.error("getLatenessPage", error);
    return { ok: false, message: "No se pudieron cargar los retardos" };
  }
}

const NOT_CONTROLLED_MESSAGE = "El empleado no tiene control de retardos en este periodo";

/**
 * Valida que el día sea un retardo hoy: hoy o anterior, con horario ese día de la semana, con una entrada
 * y con la primera entrada más de `tolerancia_minutos` tarde. Es el mismo criterio que la detección de
 * la pantalla (`calculateLatenessMinutes`), leído con la tolerancia vigente de la empresa.
 */
async function validateDayIsLateness(
  transaction: ITransactionClient,
  idEmpresa: number,
  idEmpleado: number,
  fecha: string,
): Promise<JustificationWriteCheck> {
  if (fecha > addZeroToday(new Date())) {
    return { ok: false, message: "Solo se pueden justificar retardos de hoy o de días anteriores" };
  }

  const settingsRows = await transaction.queryParams(
    `SELECT tolerancia_minutos
       FROM [CentroPodologico].[payroll].[lateness_settings]
      WHERE id_empresa = @id_empresa`,
    { id_empresa: idEmpresa },
  );
  const settings = settingsRows[0] as { tolerancia_minutos: number } | undefined;
  if (!settings) return { ok: false, message: "La empresa no tiene configuración de retardos" };

  const scheduleRows = await transaction.queryParams(
    `SELECT CONVERT(varchar(8), [hora_entrada_1], 108) AS hora_entrada_1
       FROM [CentroPodologico].[RH].[empleado_horarios]
      WHERE [id_empleado] = @id_empleado AND [dia_semana] = @dia_semana`,
    { id_empleado: idEmpleado, dia_semana: weekdayOfDate(fecha) },
  );
  const schedule = scheduleRows[0] as { hora_entrada_1: string } | undefined;
  if (!schedule) return { ok: false, message: "El empleado no tiene horario ese día" };

  const firstEntryRows = await transaction.queryParams(
    `SELECT CONVERT(varchar(8), MIN([fecha_hora]), 108) AS hora_llegada
       FROM [CentroPodologico].[RH].[asistencias]
      WHERE [id_empleado] = @id_empleado
        AND [tipo] = 'entrada'
        AND [fecha_hora] >= CAST(@fecha AS date)
        AND [fecha_hora] <  DATEADD(day, 1, CAST(@fecha AS date))`,
    { id_empleado: idEmpleado, fecha },
  );
  const arrivalTime = (firstEntryRows[0] as { hora_llegada: string | null } | undefined)?.hora_llegada;
  if (!arrivalTime) return { ok: false, message: "El empleado no tiene una entrada registrada ese día" };

  const minutesLate = calculateLatenessMinutes(schedule.hora_entrada_1, arrivalTime);
  if (minutesLate <= Number(settings.tolerancia_minutos)) {
    return { ok: false, message: "La entrada de ese día no fue un retardo" };
  }
  return { ok: true };
}

/** Justifica un retardo con un archivo (PDF, JPG o PNG); si el día ya tenía justificación, la reemplaza. */
export async function justifyLateness(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal, id_empresa, id_user } = access.data;

  const parsed = justifyLatenessSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { id_period, id_empleado, fecha, url, mime_type, size_bytes, comentario } = parsed.data;

  try {
    const result = await db.transaction(async (transaction): Promise<JustificationWriteCheck> => {
      const target = await validateJustificationTarget(
        transaction,
        id_sucursal,
        { id_period, id_empleado, fecha },
        NOT_CONTROLLED_MESSAGE,
      );
      if (!target.ok) return target;
      const day = await validateDayIsLateness(transaction, id_empresa, id_empleado, fecha);
      if (!day.ok) return day;

      await upsertJustification(transaction, "lateness_justifications", {
        id_empleado,
        fecha,
        estado: "J",
        url,
        mime_type,
        size_bytes,
        comentario: comentario ? comentario : null,
        decided_by: id_user,
      });
      return { ok: true };
    });

    if (!result.ok) return result;
    revalidatePath(LATENESS_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("justifyLateness", error);
    return { ok: false, message: "No se pudo guardar el justificante" };
  }
}

/** Marca un retardo como "No aplica" (reloj desfasado, checador sin conexión…); el comentario es obligatorio. */
export async function markLatenessNotApplicable(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal, id_empresa, id_user } = access.data;

  const parsed = markLatenessNotApplicableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { id_period, id_empleado, fecha, comentario } = parsed.data;

  try {
    const result = await db.transaction(async (transaction): Promise<JustificationWriteCheck> => {
      const target = await validateJustificationTarget(
        transaction,
        id_sucursal,
        { id_period, id_empleado, fecha },
        NOT_CONTROLLED_MESSAGE,
      );
      if (!target.ok) return target;
      const day = await validateDayIsLateness(transaction, id_empresa, id_empleado, fecha);
      if (!day.ok) return day;

      await upsertJustification(transaction, "lateness_justifications", {
        id_empleado,
        fecha,
        estado: "N",
        url: null,
        mime_type: null,
        size_bytes: null,
        comentario,
        decided_by: id_user,
      });
      return { ok: true };
    });

    if (!result.ok) return result;
    revalidatePath(LATENESS_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("markLatenessNotApplicable", error);
    return { ok: false, message: "No se pudo marcar el retardo como no aplica" };
  }
}

/**
 * Vuelve un retardo a "Injustificado": borra su justificación. Valida periodo, rango y empleado igual que las
 * otras dos, pero no revisa el día (horario y entrada) para poder limpiar una justificación que ya no aplica.
 */
export async function clearLatenessJustification(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal } = access.data;

  const parsed = clearLatenessJustificationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { id_period, id_empleado, fecha } = parsed.data;

  try {
    const result = await db.transaction(async (transaction): Promise<JustificationWriteCheck> => {
      const target = await validateJustificationTarget(
        transaction,
        id_sucursal,
        { id_period, id_empleado, fecha },
        NOT_CONTROLLED_MESSAGE,
      );
      if (!target.ok) return target;

      await transaction.queryParams(
        `DELETE FROM [CentroPodologico].[payroll].[lateness_justifications]
          WHERE id_empleado = @id_empleado AND fecha = CAST(@fecha AS date)`,
        { id_empleado, fecha },
      );
      return { ok: true };
    });

    if (!result.ok) return result;
    revalidatePath(LATENESS_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("clearLatenessJustification", error);
    return { ok: false, message: "No se pudo volver el retardo a injustificado" };
  }
}

/** Escalones ordenados por frecuencia y retardos: la forma canónica para comparar y para la bitácora. */
function sortTiers(tiers: ILatenessTier[]): ILatenessTier[] {
  return tiers
    .map((tier) => ({
      id_payment_period: Number(tier.id_payment_period),
      retardos: Number(tier.retardos),
      dias_descuento: Number(tier.dias_descuento),
    }))
    .sort((first, second) => first.id_payment_period - second.id_payment_period || first.retardos - second.retardos);
}

/**
 * Guarda la configuración de retardos de la empresa y sus escalones en una sola transacción: lee la fila con
 * UPDLOCK/HOLDLOCK, valida las frecuencias, reemplaza los escalones, actualiza `updated_at` (el aviso "Recalcula"
 * depende de esa fecha, aunque solo cambien los escalones) y escribe la bitácora. Si nada cambió no escribe nada.
 */
export async function updateLatenessSettings(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_empresa, id_user } = access.data;

  const parsed = updateLatenessSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { tolerancia_minutos, minutos_retardo_grave, dias_descuento_retardo_grave } = parsed.data;
  const newTiers = sortTiers(parsed.data.tiers);

  try {
    const result = await db.transaction(async (transaction): Promise<{ ok: true } | { ok: false; message: string }> => {
      const settingsRows = await transaction.queryParams(
        `SELECT tolerancia_minutos, minutos_retardo_grave,
                CAST(dias_descuento_retardo_grave AS float) AS dias_descuento_retardo_grave
           FROM [CentroPodologico].[payroll].[lateness_settings] WITH (UPDLOCK, HOLDLOCK)
          WHERE id_empresa = @id_empresa`,
        { id_empresa },
      );
      const previousSettings = settingsRows[0] as
        | { tolerancia_minutos: number; minutos_retardo_grave: number; dias_descuento_retardo_grave: number }
        | undefined;

      const previousTierRows = (await transaction.queryParams(
        `SELECT id_payment_period, retardos, CAST(dias_descuento AS float) AS dias_descuento
           FROM [CentroPodologico].[payroll].[lateness_tiers] WITH (UPDLOCK, HOLDLOCK)
          WHERE id_empresa = @id_empresa`,
        { id_empresa },
      )) as ILatenessTier[];
      const previousTiers = sortTiers(previousTierRows);

      // Solo se aceptan frecuencias que Periodos ofrece; el FK atraparía las inexistentes, pero con un error opaco.
      const frequencyRows = (await transaction.queryParams(
        `SELECT id_payment_period, clave_sat FROM [CentroPodologico].[RH].[payment_periods] WHERE status = 1`,
        {},
      )) as { id_payment_period: number; clave_sat: string }[];
      const allowedFrequencyIds = new Set(
        frequencyRows
          .filter((row) => row.clave_sat in PAYROLL_FREQUENCY_LETTER_BY_SAT_KEY)
          .map((row) => row.id_payment_period),
      );
      if (newTiers.some((tier) => !allowedFrequencyIds.has(tier.id_payment_period))) {
        return { ok: false, message: "Un escalón usa una frecuencia inválida" };
      }

      const hasChanged =
        !previousSettings ||
        Number(previousSettings.tolerancia_minutos) !== tolerancia_minutos ||
        Number(previousSettings.minutos_retardo_grave) !== minutos_retardo_grave ||
        Number(previousSettings.dias_descuento_retardo_grave) !== dias_descuento_retardo_grave ||
        JSON.stringify(previousTiers) !== JSON.stringify(newTiers);
      if (!hasChanged) return { ok: true };

      const settingsParams = {
        id_empresa,
        tolerancia_minutos,
        minutos_retardo_grave,
        dias_descuento_retardo_grave: String(dias_descuento_retardo_grave),
        updated_by: id_user,
        updated_at: buildDate(new Date()),
      };
      if (previousSettings) {
        await transaction.queryParams(
          `UPDATE [CentroPodologico].[payroll].[lateness_settings]
              SET tolerancia_minutos           = @tolerancia_minutos,
                  minutos_retardo_grave        = @minutos_retardo_grave,
                  dias_descuento_retardo_grave = CAST(@dias_descuento_retardo_grave AS decimal(2,1)),
                  updated_by                   = @updated_by,
                  updated_at                   = CAST(@updated_at AS datetime2(0))
            WHERE id_empresa = @id_empresa`,
          settingsParams,
        );
      } else {
        await transaction.queryParams(
          `INSERT INTO [CentroPodologico].[payroll].[lateness_settings]
             (id_empresa, tolerancia_minutos, minutos_retardo_grave, dias_descuento_retardo_grave, updated_by, updated_at)
           VALUES (@id_empresa, @tolerancia_minutos, @minutos_retardo_grave,
                   CAST(@dias_descuento_retardo_grave AS decimal(2,1)), @updated_by, CAST(@updated_at AS datetime2(0)))`,
          settingsParams,
        );
      }

      await transaction.queryParams(
        `DELETE FROM [CentroPodologico].[payroll].[lateness_tiers] WHERE id_empresa = @id_empresa`,
        { id_empresa },
      );
      for (const tier of newTiers) {
        await transaction.queryParams(
          `INSERT INTO [CentroPodologico].[payroll].[lateness_tiers]
             (id_empresa, id_payment_period, retardos, dias_descuento)
           VALUES (@id_empresa, @id_payment_period, @retardos, CAST(@dias_descuento AS decimal(3,1)))`,
          { id_empresa, id_payment_period: tier.id_payment_period, retardos: tier.retardos, dias_descuento: String(tier.dias_descuento) },
        );
      }

      await transaction.queryParams(
        `INSERT INTO [CentroPodologico].[payroll].[lateness_settings_log]
           (id_empresa,
            tolerancia_minutos_anterior, tolerancia_minutos_nuevo,
            minutos_retardo_grave_anterior, minutos_retardo_grave_nuevo,
            dias_descuento_retardo_grave_anterior, dias_descuento_retardo_grave_nuevo,
            escalones_anteriores, escalones_nuevos, updated_by, updated_at)
         VALUES
           (@id_empresa,
            @previous_tolerancia_minutos, @tolerancia_minutos,
            @previous_minutos_retardo_grave, @minutos_retardo_grave,
            CAST(@previous_dias_descuento_retardo_grave AS decimal(2,1)),
            CAST(@dias_descuento_retardo_grave AS decimal(2,1)),
            @previous_tiers_json, @new_tiers_json, @updated_by, CAST(@updated_at AS datetime2(0)))`,
        {
          ...settingsParams,
          previous_tolerancia_minutos: previousSettings ? Number(previousSettings.tolerancia_minutos) : null,
          previous_minutos_retardo_grave: previousSettings ? Number(previousSettings.minutos_retardo_grave) : null,
          previous_dias_descuento_retardo_grave: previousSettings
            ? String(previousSettings.dias_descuento_retardo_grave)
            : null,
          previous_tiers_json: previousSettings ? JSON.stringify(previousTiers) : null,
          new_tiers_json: JSON.stringify(newTiers),
        },
      );
      return { ok: true };
    });

    if (!result.ok) return result;
    revalidatePath(LATENESS_PATH);
    revalidatePath("/dashboard/nomina/procesar");
    return { ok: true, data: null };
  } catch (error) {
    console.error("updateLatenessSettings", error);
    return { ok: false, message: "No se pudo guardar la configuración de retardos" };
  }
}
