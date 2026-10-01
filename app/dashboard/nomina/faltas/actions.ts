"use server";

import db, { ITransactionClient } from "@/database/connection";
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
  loadCheckInDays,
  loadDiscountedDays,
  loadJustifications,
  loadReviewedEmployees,
  loadScheduleByEmployee,
} from "@/lib/payroll/incidentSources";
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

    const [employees, scheduleByEmployee, checkInDateRows, justificationRows, discountedRows] = await Promise.all([
      loadReviewedEmployees(id_sucursal, period),
      loadScheduleByEmployee(id_sucursal, period),
      loadCheckInDays(id_sucursal, period),
      loadJustifications("absence", id_sucursal, period),
      loadDiscountedDays("absence", id_sucursal, period),
    ]);

    const checkInDatesByEmployee = groupByEmployee(checkInDateRows);
    const justificationsByEmployee = groupByEmployee(justificationRows);
    const discountedCodesByDay = buildDiscountedCodesByDay(discountedRows);

    // El día de hoy y los futuros nunca son falta: el rango termina antes de hoy y del día siguiente al fin.
    const today = addZeroToday(new Date());
    const dayAfterPeriodEnd = nextDate(period.fecha_fin);
    const rangeEndExclusive = today < dayAfterPeriodEnd ? today : dayAfterPeriodEnd;

    const allRows: IAbsenceDayRow[] = [];
    const employeesWithoutSchedule: IAbsencePage["employeesWithoutSchedule"] = [];

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
