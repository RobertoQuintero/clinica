"use server";

import db from "@/database/connection";
import { IScheduleDay } from "@/interfaces/employee_schedule";
import {
  ILatenessDayRow,
  ILatenessEmployeeSummary,
  ILatenessFilters,
  ILatenessPage,
  ILatenessSettings,
  ILatenessSettingsLogEntry,
  ILatenessTier,
  LatenessStatus,
} from "@/interfaces/payroll_lateness";
import { ActionResult, assertPayrollAccess } from "@/lib/payroll/access";
import { LATENESS_PAGE_SIZE } from "@/lib/payroll/constants";
import {
  ABSENCE_CONTROLLED_EMPLOYEE_CONDITION,
  ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS,
} from "@/lib/payroll/eligibleEmployees";
import { EMPLOYEE_FULL_NAME_SQL } from "@/lib/payroll/employeeName";
import { calculateLatenessDiscountDays, detectEmployeeLateness } from "@/lib/payroll/latenessDetection";
import { buildDiscountedCodesByDay, groupByEmployee, normalizeSearchText } from "@/lib/payroll/listHelpers";
import { resolvePeriod } from "@/lib/payroll/period";
import { latenessPageFiltersSchema } from "@/lib/payroll/schemas";
import { addZeroToday } from "@/utils/date_helpper";

const LATENESS_SETTINGS_LOG_LIMIT = 20;

interface IReviewedEmployeeRow {
  id_empleado: number;
  codigo_empleado: string;
  nombre_completo: string;
  fecha_ingreso: string;
}

interface IStoredJustificationRow {
  id_empleado: number;
  fecha: string;
  estado: "J" | "N";
  url: string | null;
  mime_type: string | null;
  comentario: string | null;
  decided_by_name: string;
  decided_at: string;
}

interface IFirstEntryRow {
  id_empleado: number;
  fecha: string;
  hora_llegada: string;
}

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
    const [period, periodOptions, settings] = await Promise.all([
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
    ]);

    const emptyPage: ILatenessPage = {
      period,
      periodOptions: periodOptions as ILatenessPage["periodOptions"],
      canDecide: false,
      settings,
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

    const periodParams = {
      id_sucursal,
      id_payment_period: period.id_payment_period,
      fecha_fin: period.fecha_fin,
      fecha_inicio: period.fecha_inicio,
    };
    const reviewedEmployeeConditions = `${ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS}
          AND ${ABSENCE_CONTROLLED_EMPLOYEE_CONDITION}`;

    const [employees, scheduleRows, firstEntryRows, justificationRows, discountedRows] = await Promise.all([
      db.queryParams(
        `SELECT e.id_empleado, e.codigo_empleado, ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo,
                CONVERT(varchar(10), e.fecha_ingreso, 120) AS fecha_ingreso
           FROM [CentroPodologico].[RH].[empleados] e
          WHERE ${reviewedEmployeeConditions}
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
          WHERE ${reviewedEmployeeConditions}`,
        periodParams,
      ),
      // La primera checada `entrada` de cada día es la hora de llegada (el mismo criterio que Horas extra).
      db.queryParams(
        `SELECT a.[id_empleado],
                CONVERT(varchar(10), a.[fecha_hora], 120) AS fecha,
                CONVERT(varchar(8), MIN(a.[fecha_hora]), 108) AS hora_llegada
           FROM [CentroPodologico].[RH].[asistencias] a
           JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = a.id_empleado
          WHERE ${reviewedEmployeeConditions}
            AND a.[tipo] = 'entrada'
            AND a.[fecha_hora] >= CAST(@fecha_inicio AS date)
            AND a.[fecha_hora] <  DATEADD(day, 1, CAST(@fecha_fin AS date))
          GROUP BY a.[id_empleado], CONVERT(varchar(10), a.[fecha_hora], 120)`,
        periodParams,
      ),
      db.queryParams(
        `SELECT lj.[id_empleado],
                CONVERT(varchar(10), lj.[fecha], 120) AS fecha,
                lj.[estado], lj.[url], lj.[mime_type], lj.[comentario],
                ISNULL(u.[nombre], '')                AS decided_by_name,
                CONVERT(varchar(19), lj.[decided_at], 120) AS decided_at
           FROM [CentroPodologico].[payroll].[lateness_justifications] lj
           JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = lj.id_empleado
           LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = lj.decided_by
          WHERE ${reviewedEmployeeConditions}
            AND lj.[fecha] BETWEEN CAST(@fecha_inicio AS date) AND CAST(@fecha_fin AS date)`,
        periodParams,
      ),
      // Retardos ya descontados por algún periodo: el UNIQUE (id_empleado, fecha, tipo_nomina) los indexa.
      db.queryParams(
        `SELECT pl.[id_empleado], CONVERT(varchar(10), pl.[fecha], 120) AS fecha, p.[codigo]
           FROM [CentroPodologico].[payroll].[period_employee_lateness] pl
           JOIN [CentroPodologico].[payroll].[period_employees] pe ON pe.[id_period_employee] = pl.[id_period_employee]
           JOIN [CentroPodologico].[payroll].[periods] p ON p.[id_period] = pe.[id_period]
           JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = pl.[id_empleado]
          WHERE ${reviewedEmployeeConditions}
            AND pl.[fecha] BETWEEN CAST(@fecha_inicio AS date) AND CAST(@fecha_fin AS date)
          ORDER BY p.[codigo]`,
        periodParams,
      ),
    ]);

    const scheduleByEmployee = new Map(
      [...groupByEmployee(scheduleRows as (IScheduleDay & { id_empleado: number })[])].map(
        ([idEmpleado, days]) => [idEmpleado, days as IScheduleDay[]],
      ),
    );
    const firstEntriesByEmployee = groupByEmployee(firstEntryRows as IFirstEntryRow[]);
    const justificationsByEmployee = groupByEmployee(justificationRows as IStoredJustificationRow[]);
    const discountedCodesByDay = buildDiscountedCodesByDay(
      discountedRows as { id_empleado: number; fecha: string; codigo: string }[],
    );

    // El día de hoy sí se evalúa (el retardo es definitivo en cuanto existe la entrada); los futuros no.
    const today = addZeroToday(new Date());
    const rangeEndInclusive = today < period.fecha_fin ? today : period.fecha_fin;

    const allRows: ILatenessDayRow[] = [];
    const employeeSummaries: ILatenessEmployeeSummary[] = [];
    const employeesWithoutSchedule: ILatenessPage["employeesWithoutSchedule"] = [];

    for (const employee of employees as IReviewedEmployeeRow[]) {
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
        // El aviso "Recalcula" se conecta en el paso 12.
        recalculationNeeded: false,
      },
    };
  } catch (error) {
    console.error("getLatenessPage", error);
    return { ok: false, message: "No se pudieron cargar los retardos" };
  }
}
