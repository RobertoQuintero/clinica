"use server";

import db, { ITransactionClient } from "@/database/connection";
import { IScheduleDay } from "@/interfaces/employee_schedule";
import { AbsenceStatus, IAbsenceDayRow, IAbsenceFilters, IAbsencePage } from "@/interfaces/payroll_absence";
import { ActionResult, assertPayrollAccess } from "@/lib/payroll/access";
import {
  JustificationWriteCheck,
  upsertJustification,
  validateJustificationTarget,
} from "@/lib/payroll/justificationWrites";
import { detectEmployeeAbsences, nextDate } from "@/lib/payroll/absenceDetection";
import { isAbsenceRecalculationNeeded } from "@/lib/payroll/absenceRecalculation";
import { ABSENCE_PAGE_SIZE } from "@/lib/payroll/constants";
import {
  ABSENCE_CONTROLLED_EMPLOYEE_CONDITION,
  ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS,
} from "@/lib/payroll/eligibleEmployees";
import { EMPLOYEE_FULL_NAME_SQL } from "@/lib/payroll/employeeName";
import { buildDiscountedCodesByDay, groupByEmployee, normalizeSearchText } from "@/lib/payroll/listHelpers";
import { weekdayOfDate } from "@/lib/payroll/overtimeDetection";
import { resolvePeriod } from "@/lib/payroll/period";
import {
  absencePageFiltersSchema,
  clearAbsenceJustificationSchema,
  justifyAbsenceSchema,
  markAbsenceNotApplicableSchema,
} from "@/lib/payroll/schemas";
import { addZeroToday } from "@/utils/date_helpper";
import { revalidatePath } from "next/cache";

const ABSENCES_PATH = "/dashboard/nomina/faltas";

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

/**
 * Lista de faltas de un periodo (spec 62): detección en vivo por empleado con control de faltas, unida con
 * las justificaciones guardadas. Son cinco SELECT en total (empleados, horarios, días con checada,
 * justificaciones y días ya descontados); el resumen se calcula sin filtros y después se aplican el estado,
 * la búsqueda y la paginación.
 */
export async function getAbsencePage(filters: IAbsenceFilters): Promise<ActionResult<IAbsencePage>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal } = access.data;

  const parsedFilters = absencePageFiltersSchema.safeParse(filters);
  if (!parsedFilters.success) {
    return { ok: false, message: parsedFilters.error.issues[0]?.message ?? "Filtros inválidos" };
  }
  const { idPeriod, status: statusFilter, search: rawSearch, page } = parsedFilters.data;

  try {
    const [period, periodOptions] = await Promise.all([
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
    ]);

    const emptyPage: IAbsencePage = {
      period,
      periodOptions: periodOptions as IAbsencePage["periodOptions"],
      canDecide: false,
      rows: [],
      totalRows: 0,
      summary: { unjustifiedDays: 0, justifiedDays: 0, notApplicableDays: 0 },
      employeesWithoutSchedule: [],
      recalculationNeeded: false,
    };
    if (!period) return { ok: true, data: emptyPage };

    const periodParams = {
      id_sucursal,
      id_payment_period: period.id_payment_period,
      fecha_fin: period.fecha_fin,
      fecha_inicio: period.fecha_inicio,
    };
    const reviewedEmployeeConditions = `${ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS}
          AND ${ABSENCE_CONTROLLED_EMPLOYEE_CONDITION}`;

    const [employees, scheduleRows, checkInDateRows, justificationRows, discountedRows] = await Promise.all([
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
      // Solo importa si el día tiene alguna checada, de cualquier tipo.
      db.queryParams(
        `SELECT DISTINCT a.[id_empleado], CONVERT(varchar(10), a.[fecha_hora], 120) AS fecha
           FROM [CentroPodologico].[RH].[asistencias] a
           JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = a.id_empleado
          WHERE ${reviewedEmployeeConditions}
            AND a.[fecha_hora] >= CAST(@fecha_inicio AS date)
            AND a.[fecha_hora] <  DATEADD(day, 1, CAST(@fecha_fin AS date))`,
        periodParams,
      ),
      db.queryParams(
        `SELECT aj.[id_empleado],
                CONVERT(varchar(10), aj.[fecha], 120) AS fecha,
                aj.[estado], aj.[url], aj.[mime_type], aj.[comentario],
                ISNULL(u.[nombre], '')                AS decided_by_name,
                CONVERT(varchar(19), aj.[decided_at], 120) AS decided_at
           FROM [CentroPodologico].[payroll].[absence_justifications] aj
           JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = aj.id_empleado
           LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = aj.decided_by
          WHERE ${reviewedEmployeeConditions}
            AND aj.[fecha] BETWEEN CAST(@fecha_inicio AS date) AND CAST(@fecha_fin AS date)`,
        periodParams,
      ),
      // Días ya descontados por algún periodo: el UNIQUE (id_empleado, fecha, tipo_nomina) los indexa.
      db.queryParams(
        `SELECT pa.[id_empleado], CONVERT(varchar(10), pa.[fecha], 120) AS fecha, p.[codigo]
           FROM [CentroPodologico].[payroll].[period_employee_absences] pa
           JOIN [CentroPodologico].[payroll].[period_employees] pe ON pe.[id_period_employee] = pa.[id_period_employee]
           JOIN [CentroPodologico].[payroll].[periods] p ON p.[id_period] = pe.[id_period]
           JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = pa.[id_empleado]
          WHERE ${reviewedEmployeeConditions}
            AND pa.[fecha] BETWEEN CAST(@fecha_inicio AS date) AND CAST(@fecha_fin AS date)
          ORDER BY p.[codigo]`,
        periodParams,
      ),
    ]);

    const scheduleByEmployee = new Map(
      [...groupByEmployee(scheduleRows as (IScheduleDay & { id_empleado: number })[])].map(
        ([idEmpleado, days]) => [idEmpleado, days as IScheduleDay[]],
      ),
    );
    const checkInDatesByEmployee = groupByEmployee(checkInDateRows as { id_empleado: number; fecha: string }[]);
    const justificationsByEmployee = groupByEmployee(justificationRows as IStoredJustificationRow[]);
    const discountedCodesByDay = buildDiscountedCodesByDay(
      discountedRows as { id_empleado: number; fecha: string; codigo: string }[],
    );

    // El día de hoy y los futuros nunca son falta: el rango termina antes de hoy y del día siguiente al fin.
    const today = addZeroToday(new Date());
    const dayAfterPeriodEnd = nextDate(period.fecha_fin);
    const rangeEndExclusive = today < dayAfterPeriodEnd ? today : dayAfterPeriodEnd;

    const allRows: IAbsenceDayRow[] = [];
    const employeesWithoutSchedule: IAbsencePage["employeesWithoutSchedule"] = [];

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
      const checkInDates = (checkInDatesByEmployee.get(employee.id_empleado) ?? []).map((row) => row.fecha);
      const justificationsByDate = new Map(
        (justificationsByEmployee.get(employee.id_empleado) ?? []).map((justification) => [
          justification.fecha,
          justification,
        ]),
      );

      for (const absence of detectEmployeeAbsences(schedule, checkInDates, rangeStart, rangeEndExclusive)) {
        const justification = justificationsByDate.get(absence.fecha);
        const rowStatus: AbsenceStatus = !justification
          ? "unjustified"
          : justification.estado === "J"
            ? "justified"
            : "not_applicable";
        allRows.push({
          ...absence,
          id_empleado: employee.id_empleado,
          codigo_empleado: employee.codigo_empleado,
          nombre_completo: employee.nombre_completo,
          status: rowStatus,
          url: justification?.url ?? null,
          mime_type: justification?.mime_type ?? null,
          comentario: justification?.comentario ?? null,
          decided_by_name: justification?.decided_by_name ?? null,
          decided_at: justification?.decided_at ?? null,
          discountedInPeriodCodes: discountedCodesByDay.get(`${employee.id_empleado}|${absence.fecha}`) ?? [],
        });
      }
    }

    // Resumen del periodo completo: no cambia con el filtro de estado ni con la búsqueda.
    const summary = {
      unjustifiedDays: allRows.filter((row) => row.status === "unjustified").length,
      justifiedDays: allRows.filter((row) => row.status === "justified").length,
      notApplicableDays: allRows.filter((row) => row.status === "not_applicable").length,
    };

    const search = normalizeSearchText(rawSearch.trim());
    const filteredRows = allRows.filter(
      (row) =>
        (statusFilter === "all" || row.status === statusFilter) &&
        (search === "" ||
          normalizeSearchText(row.nombre_completo).includes(search) ||
          normalizeSearchText(row.codigo_empleado).includes(search)),
    );

    const recalculationNeeded = await isAbsenceRecalculationNeeded(period.id_period);

    const pageStart = (page - 1) * ABSENCE_PAGE_SIZE;

    return {
      ok: true,
      data: {
        ...emptyPage,
        canDecide: period.status === 1 || period.status === 2,
        recalculationNeeded,
        rows: filteredRows.slice(pageStart, pageStart + ABSENCE_PAGE_SIZE),
        totalRows: filteredRows.length,
        summary,
        employeesWithoutSchedule,
      },
    };
  } catch (error) {
    console.error("getAbsencePage", error);
    return { ok: false, message: "No se pudieron cargar las faltas" };
  }
}

const NOT_CONTROLLED_MESSAGE = "El empleado no tiene control de faltas en este periodo";

type AbsenceWriteCheck = JustificationWriteCheck;

/** Valida que el día sea una falta hoy: anterior a hoy, con horario ese día de la semana y sin ninguna checada. */
async function validateDayIsAbsence(
  transaction: ITransactionClient,
  idEmpleado: number,
  fecha: string,
): Promise<AbsenceWriteCheck> {
  if (fecha >= addZeroToday(new Date())) {
    return { ok: false, message: "Solo se pueden justificar días anteriores a hoy" };
  }

  const scheduleRows = await transaction.queryParams(
    `SELECT 1 AS scheduled
       FROM [CentroPodologico].[RH].[empleado_horarios]
      WHERE [id_empleado] = @id_empleado AND [dia_semana] = @dia_semana`,
    { id_empleado: idEmpleado, dia_semana: weekdayOfDate(fecha) },
  );
  if (scheduleRows.length === 0) {
    return { ok: false, message: "El empleado no tiene horario ese día" };
  }

  const checkInRows = await transaction.queryParams(
    `SELECT TOP 1 1 AS has_check_in
       FROM [CentroPodologico].[RH].[asistencias]
      WHERE [id_empleado] = @id_empleado
        AND [fecha_hora] >= CAST(@fecha AS date)
        AND [fecha_hora] <  DATEADD(day, 1, CAST(@fecha AS date))`,
    { id_empleado: idEmpleado, fecha },
  );
  if (checkInRows.length > 0) {
    return { ok: false, message: "El empleado tiene checadas ese día, no es una falta" };
  }
  return { ok: true };
}

/** Justifica una falta con un archivo (PDF, JPG o PNG); si el día ya tenía justificación, la reemplaza. */
export async function justifyAbsence(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal, id_user } = access.data;

  const parsed = justifyAbsenceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { id_period, id_empleado, fecha, url, mime_type, size_bytes, comentario } = parsed.data;

  try {
    const result = await db.transaction(async (transaction): Promise<AbsenceWriteCheck> => {
      const target = await validateJustificationTarget(
        transaction,
        id_sucursal,
        { id_period, id_empleado, fecha },
        NOT_CONTROLLED_MESSAGE,
      );
      if (!target.ok) return target;
      const day = await validateDayIsAbsence(transaction, id_empleado, fecha);
      if (!day.ok) return day;

      await upsertJustification(transaction, "absence_justifications", {
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
    revalidatePath(ABSENCES_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("justifyAbsence", error);
    return { ok: false, message: "No se pudo guardar el justificante" };
  }
}

/** Marca una falta como "No aplica" (festivo, vacaciones, checador sin conexión…); el comentario es obligatorio. */
export async function markAbsenceNotApplicable(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal, id_user } = access.data;

  const parsed = markAbsenceNotApplicableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { id_period, id_empleado, fecha, comentario } = parsed.data;

  try {
    const result = await db.transaction(async (transaction): Promise<AbsenceWriteCheck> => {
      const target = await validateJustificationTarget(
        transaction,
        id_sucursal,
        { id_period, id_empleado, fecha },
        NOT_CONTROLLED_MESSAGE,
      );
      if (!target.ok) return target;
      const day = await validateDayIsAbsence(transaction, id_empleado, fecha);
      if (!day.ok) return day;

      await upsertJustification(transaction, "absence_justifications", {
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
    revalidatePath(ABSENCES_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("markAbsenceNotApplicable", error);
    return { ok: false, message: "No se pudo marcar la falta como no aplica" };
  }
}

/**
 * Vuelve una falta a "Injustificada": borra su justificación. Valida periodo, rango y empleado igual que las
 * otras dos, pero no revisa el día (horario y checadas) para poder limpiar una justificación que ya no aplica.
 */
export async function clearAbsenceJustification(input: unknown): Promise<ActionResult<null>> {
  const access = await assertPayrollAccess();
  if (!access.ok) return access;
  const { id_sucursal } = access.data;

  const parsed = clearAbsenceJustificationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { id_period, id_empleado, fecha } = parsed.data;

  try {
    const result = await db.transaction(async (transaction): Promise<AbsenceWriteCheck> => {
      const target = await validateJustificationTarget(
        transaction,
        id_sucursal,
        { id_period, id_empleado, fecha },
        NOT_CONTROLLED_MESSAGE,
      );
      if (!target.ok) return target;

      await transaction.queryParams(
        `DELETE FROM [CentroPodologico].[payroll].[absence_justifications]
          WHERE id_empleado = @id_empleado AND fecha = CAST(@fecha AS date)`,
        { id_empleado, fecha },
      );
      return { ok: true };
    });

    if (!result.ok) return result;
    revalidatePath(ABSENCES_PATH);
    return { ok: true, data: null };
  } catch (error) {
    console.error("clearAbsenceJustification", error);
    return { ok: false, message: "No se pudo volver la falta a injustificada" };
  }
}
