"use server";

import db from "@/database/connection";
import {
  IPunctualityBonusEmployeeRow,
  IPunctualityBonusFilters,
  IPunctualityBonusPage,
  IPunctualityBonusSetting,
  IPunctualityBonusSettingsLogEntry,
} from "@/interfaces/payroll_punctuality_bonus";
import { ActionResult, assertPayrollAccess } from "@/lib/payroll/access";
import { detectEmployeeAbsences, nextDate } from "@/lib/payroll/absenceDetection";
import { PAYROLL_FREQUENCY_LETTER_BY_SAT_KEY, PUNCTUALITY_BONUS_PAGE_SIZE } from "@/lib/payroll/constants";
import {
  loadCheckInDays,
  loadFirstEntries,
  loadJustifications,
  loadReviewedEmployees,
  loadScheduleByEmployee,
} from "@/lib/payroll/incidentSources";
import { detectEmployeeLateness } from "@/lib/payroll/latenessDetection";
import { groupByEmployee, normalizeSearchText } from "@/lib/payroll/listHelpers";
import { resolvePeriod } from "@/lib/payroll/period";
import { evaluatePunctualityBonus } from "@/lib/payroll/punctualityBonus";
import { punctualityBonusPageFiltersSchema } from "@/lib/payroll/schemas";
import { addZeroToday } from "@/utils/date_helpper";

const PUNCTUALITY_BONUS_SETTINGS_LOG_LIMIT = 20;

/**
 * Una configuración por frecuencia activa que Periodos ofrece (claves SAT con letra definida), tenga o no fila.
 * Sin fila: `updated_at` y `updated_by_name` son null, `monto` y `maximo_incidencias` 0 y `status` false.
 */
async function loadPunctualityBonusSettings(idEmpresa: number): Promise<IPunctualityBonusSetting[]> {
  const rows = await db.queryParams(
    `SELECT pp.id_payment_period, pp.clave_sat, pp.description AS frequencyName,
            CAST(ISNULL(s.monto, 0) AS float)            AS monto,
            ISNULL(s.maximo_incidencias, 0)              AS maximo_incidencias,
            ISNULL(s.status, 0)                          AS status,
            u.nombre                                     AS updated_by_name,
            CONVERT(varchar(19), s.updated_at, 120)      AS updated_at
       FROM [CentroPodologico].[RH].[payment_periods] pp
       LEFT JOIN [CentroPodologico].[payroll].[punctuality_bonus_settings] s
         ON s.id_payment_period = pp.id_payment_period AND s.id_empresa = @id_empresa
       LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = s.updated_by
      WHERE pp.status = 1
      ORDER BY pp.id_payment_period`,
    { id_empresa: idEmpresa },
  );
  return (rows as IPunctualityBonusSetting[])
    .filter((row) => row.clave_sat in PAYROLL_FREQUENCY_LETTER_BY_SAT_KEY)
    .map((row) => ({
      id_payment_period: Number(row.id_payment_period),
      clave_sat: row.clave_sat,
      frequencyName: row.frequencyName,
      monto: Number(row.monto),
      maximo_incidencias: Number(row.maximo_incidencias),
      status: Boolean(row.status),
      updated_by_name: row.updated_by_name ?? null,
      updated_at: row.updated_at ?? null,
    }));
}

/** Las últimas 20 entradas de la bitácora de la empresa, de la más reciente a la más antigua. */
export async function getPunctualityBonusSettingsLog(): Promise<ActionResult<IPunctualityBonusSettingsLogEntry[]>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;

  try {
    const rows = await db.queryParams(
      `SELECT TOP (@limit)
              l.id_log,
              pp.description                                         AS frequencyName,
              CAST(l.monto_anterior AS float)                        AS monto_anterior,
              CAST(l.monto_nuevo AS float)                           AS monto_nuevo,
              l.maximo_incidencias_anterior, l.maximo_incidencias_nuevo,
              l.status_anterior, l.status_nuevo,
              ISNULL(u.nombre, '')                                   AS updated_by_name,
              CONVERT(varchar(19), l.updated_at, 120)                AS updated_at
         FROM [CentroPodologico].[payroll].[punctuality_bonus_settings_log] l
         JOIN [CentroPodologico].[RH].[payment_periods] pp ON pp.id_payment_period = l.id_payment_period
         LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = l.updated_by
        WHERE l.id_empresa = @id_empresa
        ORDER BY l.updated_at DESC, l.id_log DESC`,
      { id_empresa: access.data.id_empresa, limit: PUNCTUALITY_BONUS_SETTINGS_LOG_LIMIT },
    );
    return {
      ok: true,
      data: (rows as IPunctualityBonusSettingsLogEntry[]).map((row) => ({
        id_log: Number(row.id_log),
        frequencyName: row.frequencyName,
        monto_anterior: row.monto_anterior === null ? null : Number(row.monto_anterior),
        monto_nuevo: Number(row.monto_nuevo),
        maximo_incidencias_anterior:
          row.maximo_incidencias_anterior === null ? null : Number(row.maximo_incidencias_anterior),
        maximo_incidencias_nuevo: Number(row.maximo_incidencias_nuevo),
        status_anterior: row.status_anterior === null ? null : Boolean(row.status_anterior),
        status_nuevo: Boolean(row.status_nuevo),
        updated_by_name: row.updated_by_name,
        updated_at: row.updated_at,
      })),
    };
  } catch (error) {
    console.error("getPunctualityBonusSettingsLog", error);
    return { ok: false, message: "No se pudo cargar la bitácora de cambios" };
  }
}

/**
 * Vista previa del bono de puntualidad de un periodo (spec 64): por cada podólogo con control, cuenta sus retardos y
 * faltas injustificados con las mismas reglas de detección de las specs 62 y 63 (sin quitar los días que otro periodo
 * ya descontó) y los evalúa con el helper espejo. El resumen se calcula sin filtros y después se aplican resultado,
 * búsqueda y paginación. En el cálculo manda el SQL; esto solo alimenta la pantalla.
 */
export async function getPunctualityBonusPage(
  filters: IPunctualityBonusFilters,
): Promise<ActionResult<IPunctualityBonusPage>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal, id_empresa } = access.data;

  const parsedFilters = punctualityBonusPageFiltersSchema.safeParse(filters);
  if (!parsedFilters.success) {
    return { ok: false, message: parsedFilters.error.issues[0]?.message ?? "Filtros inválidos" };
  }
  const { idPeriod, result: resultFilter, search: rawSearch, page } = parsedFilters.data;

  try {
    const [period, periodOptions, settings, latenessSettingsRows] = await Promise.all([
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
      loadPunctualityBonusSettings(id_empresa),
      db.queryParams(
        `SELECT tolerancia_minutos, minutos_retardo_grave
           FROM [CentroPodologico].[payroll].[lateness_settings]
          WHERE id_empresa = @id_empresa`,
        { id_empresa },
      ),
    ]);

    const latenessSettings = latenessSettingsRows[0]
      ? {
          tolerancia_minutos: Number(latenessSettingsRows[0].tolerancia_minutos),
          minutos_retardo_grave: Number(latenessSettingsRows[0].minutos_retardo_grave),
        }
      : null;

    const emptyPage: IPunctualityBonusPage = {
      period,
      periodOptions: periodOptions as IPunctualityBonusPage["periodOptions"],
      settings,
      periodSetting: null,
      hasLatenessSettings: latenessSettings !== null,
      rows: [],
      totalRows: 0,
      summary: { keeps: 0, loses: 0, notEvaluated: 0, estimatedAmount: 0 },
      employeesWithoutSchedule: [],
      recalculationNeeded: false,
    };
    if (!period) return { ok: true, data: emptyPage };

    const periodSetting = settings.find((setting) => setting.id_payment_period === period.id_payment_period) ?? null;
    // Una frecuencia sin fila no tiene bono, igual que una con status = 0.
    const activeSetting = periodSetting && periodSetting.updated_at !== null && periodSetting.status ? periodSetting : null;
    // Sin tolerancia o sin bono nadie se evalúa: no hace falta leer checadas ni justificaciones.
    const canDetectIncidents = latenessSettings !== null && activeSetting !== null;

    const [employees, scheduleByEmployee, checkInDateRows, firstEntryRows, absenceJustificationRows, latenessJustificationRows] =
      await Promise.all([
        loadReviewedEmployees(id_sucursal, period),
        loadScheduleByEmployee(id_sucursal, period),
        canDetectIncidents ? loadCheckInDays(id_sucursal, period) : Promise.resolve([]),
        canDetectIncidents ? loadFirstEntries(id_sucursal, period) : Promise.resolve([]),
        canDetectIncidents ? loadJustifications("absence", id_sucursal, period) : Promise.resolve([]),
        canDetectIncidents ? loadJustifications("lateness", id_sucursal, period) : Promise.resolve([]),
      ]);

    const checkInDatesByEmployee = groupByEmployee(checkInDateRows);
    const firstEntriesByEmployee = groupByEmployee(firstEntryRows);
    const absenceJustificationsByEmployee = groupByEmployee(absenceJustificationRows);
    const latenessJustificationsByEmployee = groupByEmployee(latenessJustificationRows);

    // Los retardos van hasta hoy inclusive; las faltas hasta el día anterior a hoy.
    const today = addZeroToday(new Date());
    const latenessRangeEnd = today < period.fecha_fin ? today : period.fecha_fin;
    const dayAfterPeriodEnd = nextDate(period.fecha_fin);
    const absenceRangeEndExclusive = today < dayAfterPeriodEnd ? today : dayAfterPeriodEnd;

    const allRows: IPunctualityBonusEmployeeRow[] = [];
    const employeesWithoutSchedule: IPunctualityBonusPage["employeesWithoutSchedule"] = [];

    for (const employee of employees) {
      const schedule = scheduleByEmployee.get(employee.id_empleado) ?? [];
      const hasSchedule = schedule.length > 0;
      if (!hasSchedule) {
        employeesWithoutSchedule.push({ id_empleado: employee.id_empleado, nombre_completo: employee.nombre_completo });
      }

      let lateCount = 0;
      let absenceCount = 0;
      if (canDetectIncidents && hasSchedule) {
        const rangeStart = employee.fecha_ingreso > period.fecha_inicio ? employee.fecha_ingreso : period.fecha_inicio;

        const justifiedLatenessDates = new Set(
          (latenessJustificationsByEmployee.get(employee.id_empleado) ?? []).map((row) => row.fecha),
        );
        const firstEntryByDate = new Map(
          (firstEntriesByEmployee.get(employee.id_empleado) ?? []).map((row) => [row.fecha, row.hora_llegada]),
        );
        lateCount = detectEmployeeLateness(schedule, firstEntryByDate, rangeStart, latenessRangeEnd, latenessSettings).filter(
          (lateness) => !justifiedLatenessDates.has(lateness.fecha),
        ).length;

        const justifiedAbsenceDates = new Set(
          (absenceJustificationsByEmployee.get(employee.id_empleado) ?? []).map((row) => row.fecha),
        );
        const checkInDates = (checkInDatesByEmployee.get(employee.id_empleado) ?? []).map((row) => row.fecha);
        absenceCount = detectEmployeeAbsences(schedule, checkInDates, rangeStart, absenceRangeEndExclusive).filter(
          (absence) => !justifiedAbsenceDates.has(absence.fecha),
        ).length;
      }

      allRows.push({
        id_empleado: employee.id_empleado,
        codigo_empleado: employee.codigo_empleado,
        nombre_completo: employee.nombre_completo,
        ...evaluatePunctualityBonus({
          hasLatenessSettings: latenessSettings !== null,
          setting: activeSetting ? periodSetting : null,
          fechaIngreso: employee.fecha_ingreso,
          fechaInicio: period.fecha_inicio,
          hasSchedule,
          lateCount,
          absenceCount,
        }),
      });
    }

    // Tarjetas del periodo completo: no cambian con el filtro de resultado ni con la búsqueda.
    const summary = {
      keeps: allRows.filter((row) => row.result === "keeps").length,
      loses: allRows.filter((row) => row.result === "loses").length,
      notEvaluated: allRows.filter((row) => row.result === "not_evaluated").length,
      estimatedAmount: Math.round(allRows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100,
    };

    const search = normalizeSearchText(rawSearch.trim());
    const filteredRows = allRows.filter(
      (row) =>
        (resultFilter === "all" || row.result === resultFilter) &&
        (search === "" ||
          normalizeSearchText(row.nombre_completo).includes(search) ||
          normalizeSearchText(row.codigo_empleado).includes(search)),
    );

    const pageStart = (page - 1) * PUNCTUALITY_BONUS_PAGE_SIZE;

    return {
      ok: true,
      data: {
        ...emptyPage,
        periodSetting,
        rows: filteredRows.slice(pageStart, pageStart + PUNCTUALITY_BONUS_PAGE_SIZE),
        totalRows: filteredRows.length,
        summary,
        employeesWithoutSchedule,
        // El aviso "Recalcula" se conecta en el paso 11.
        recalculationNeeded: false,
      },
    };
  } catch (error) {
    console.error("getPunctualityBonusPage", error);
    return { ok: false, message: "No se pudo cargar el bono de puntualidad" };
  }
}
