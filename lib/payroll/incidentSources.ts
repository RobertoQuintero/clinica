import "server-only";

import db from "@/database/connection";
import { IScheduleDay } from "@/interfaces/employee_schedule";
import {
  ABSENCE_CONTROLLED_EMPLOYEE_CONDITION,
  ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS,
} from "@/lib/payroll/eligibleEmployees";
import { EMPLOYEE_FULL_NAME_SQL } from "@/lib/payroll/employeeName";
import { groupByEmployee } from "@/lib/payroll/listHelpers";

/**
 * Fuentes de datos compartidas por las pantallas de incidencias (Faltas spec 62, Retardos spec 63 y Bonos spec 64):
 * empleados con control, horarios, checadas por día, primera entrada y justificaciones. Cada pantalla sigue
 * armando sus propias reglas de detección; aquí solo vive el SELECT.
 */

export interface IIncidentPeriodRange {
  id_payment_period: number;
  fecha_inicio:      string;   // "YYYY-MM-DD"
  fecha_fin:         string;   // "YYYY-MM-DD"
}

export interface IReviewedEmployeeRow {
  id_empleado:     number;
  codigo_empleado: string;
  nombre_completo: string;
  fecha_ingreso:   string;   // "YYYY-MM-DD"
}

export interface IStoredJustificationRow {
  id_empleado:     number;
  fecha:           string;
  estado:          "J" | "N";
  url:             string | null;
  mime_type:       string | null;
  comentario:      string | null;
  decided_by_name: string;
  decided_at:      string;
}

export interface IFirstEntryRow {
  id_empleado:  number;
  fecha:        string;
  hora_llegada: string;
}

export interface ICheckInDateRow {
  id_empleado: number;
  fecha:       string;
}

export type IncidentJustificationKind = "absence" | "lateness";

const JUSTIFICATION_TABLE_BY_KIND: Record<IncidentJustificationKind, string> = {
  absence:  "[CentroPodologico].[payroll].[absence_justifications]",
  lateness: "[CentroPodologico].[payroll].[lateness_justifications]",
};

/** Mismo universo que Faltas y Retardos: elegibles de cualquier nómina más el usuario podólogo activo. */
const REVIEWED_EMPLOYEE_CONDITIONS = `${ELIGIBLE_ANY_PAYROLL_EMPLOYEE_CONDITIONS}
          AND ${ABSENCE_CONTROLLED_EMPLOYEE_CONDITION}`;

function buildPeriodParams(idSucursal: number, period: IIncidentPeriodRange) {
  return {
    id_sucursal: idSucursal,
    id_payment_period: period.id_payment_period,
    fecha_fin: period.fecha_fin,
    fecha_inicio: period.fecha_inicio,
  };
}

export async function loadReviewedEmployees(
  idSucursal: number,
  period: IIncidentPeriodRange,
): Promise<IReviewedEmployeeRow[]> {
  const rows = await db.queryParams(
    `SELECT e.id_empleado, e.codigo_empleado, ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo,
            CONVERT(varchar(10), e.fecha_ingreso, 120) AS fecha_ingreso
       FROM [CentroPodologico].[RH].[empleados] e
      WHERE ${REVIEWED_EMPLOYEE_CONDITIONS}
      ORDER BY e.apellido_paterno, e.apellido_materno, e.nombre, e.id_empleado`,
    buildPeriodParams(idSucursal, period),
  );
  return rows as IReviewedEmployeeRow[];
}

/** Horario semanal de los empleados con control, agrupado por empleado. Sin filas = sin horario. */
export async function loadScheduleByEmployee(
  idSucursal: number,
  period: IIncidentPeriodRange,
): Promise<Map<number, IScheduleDay[]>> {
  const rows = await db.queryParams(
    `SELECT h.[id_empleado], h.[dia_semana],
            CONVERT(varchar(5), h.[hora_entrada_1], 108) AS hora_entrada_1,
            CONVERT(varchar(5), h.[hora_salida_1],  108) AS hora_salida_1,
            CONVERT(varchar(5), h.[hora_entrada_2], 108) AS hora_entrada_2,
            CONVERT(varchar(5), h.[hora_salida_2],  108) AS hora_salida_2
       FROM [CentroPodologico].[RH].[empleado_horarios] h
       JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = h.id_empleado
      WHERE ${REVIEWED_EMPLOYEE_CONDITIONS}`,
    buildPeriodParams(idSucursal, period),
  );
  return new Map(
    [...groupByEmployee(rows as (IScheduleDay & { id_empleado: number })[])].map(([idEmpleado, days]) => [
      idEmpleado,
      days as IScheduleDay[],
    ]),
  );
}

/** Días con alguna checada, de cualquier tipo: lo único que importa para detectar una falta. */
export async function loadCheckInDays(
  idSucursal: number,
  period: IIncidentPeriodRange,
): Promise<ICheckInDateRow[]> {
  const rows = await db.queryParams(
    `SELECT DISTINCT a.[id_empleado], CONVERT(varchar(10), a.[fecha_hora], 120) AS fecha
       FROM [CentroPodologico].[RH].[asistencias] a
       JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = a.id_empleado
      WHERE ${REVIEWED_EMPLOYEE_CONDITIONS}
        AND a.[fecha_hora] >= CAST(@fecha_inicio AS date)
        AND a.[fecha_hora] <  DATEADD(day, 1, CAST(@fecha_fin AS date))`,
    buildPeriodParams(idSucursal, period),
  );
  return rows as ICheckInDateRow[];
}

/** La primera checada `entrada` de cada día es la hora de llegada (el mismo criterio que Horas extra). */
export async function loadFirstEntries(
  idSucursal: number,
  period: IIncidentPeriodRange,
): Promise<IFirstEntryRow[]> {
  const rows = await db.queryParams(
    `SELECT a.[id_empleado],
            CONVERT(varchar(10), a.[fecha_hora], 120) AS fecha,
            CONVERT(varchar(8), MIN(a.[fecha_hora]), 108) AS hora_llegada
       FROM [CentroPodologico].[RH].[asistencias] a
       JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = a.id_empleado
      WHERE ${REVIEWED_EMPLOYEE_CONDITIONS}
        AND a.[tipo] = 'entrada'
        AND a.[fecha_hora] >= CAST(@fecha_inicio AS date)
        AND a.[fecha_hora] <  DATEADD(day, 1, CAST(@fecha_fin AS date))
      GROUP BY a.[id_empleado], CONVERT(varchar(10), a.[fecha_hora], 120)`,
    buildPeriodParams(idSucursal, period),
  );
  return rows as IFirstEntryRow[];
}

/** Justificaciones ('J') y "No aplica" ('N') guardadas dentro de las fechas del periodo. */
export async function loadJustifications(
  kind: IncidentJustificationKind,
  idSucursal: number,
  period: IIncidentPeriodRange,
): Promise<IStoredJustificationRow[]> {
  const rows = await db.queryParams(
    `SELECT j.[id_empleado],
            CONVERT(varchar(10), j.[fecha], 120) AS fecha,
            j.[estado], j.[url], j.[mime_type], j.[comentario],
            ISNULL(u.[nombre], '')                AS decided_by_name,
            CONVERT(varchar(19), j.[decided_at], 120) AS decided_at
       FROM ${JUSTIFICATION_TABLE_BY_KIND[kind]} j
       JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = j.id_empleado
       LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.id_user = j.decided_by
      WHERE ${REVIEWED_EMPLOYEE_CONDITIONS}
        AND j.[fecha] BETWEEN CAST(@fecha_inicio AS date) AND CAST(@fecha_fin AS date)`,
    buildPeriodParams(idSucursal, period),
  );
  return rows as IStoredJustificationRow[];
}

const DISCOUNTED_TABLE_BY_KIND: Record<IncidentJustificationKind, string> = {
  absence:  "[CentroPodologico].[payroll].[period_employee_absences]",
  lateness: "[CentroPodologico].[payroll].[period_employee_lateness]",
};

/** Días ya descontados por algún periodo: el UNIQUE (id_empleado, fecha, tipo_nomina) los indexa. */
export async function loadDiscountedDays(
  kind: IncidentJustificationKind,
  idSucursal: number,
  period: IIncidentPeriodRange,
): Promise<{ id_empleado: number; fecha: string; codigo: string }[]> {
  const rows = await db.queryParams(
    `SELECT d.[id_empleado], CONVERT(varchar(10), d.[fecha], 120) AS fecha, p.[codigo]
       FROM ${DISCOUNTED_TABLE_BY_KIND[kind]} d
       JOIN [CentroPodologico].[payroll].[period_employees] pe ON pe.[id_period_employee] = d.[id_period_employee]
       JOIN [CentroPodologico].[payroll].[periods] p ON p.[id_period] = pe.[id_period]
       JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = d.[id_empleado]
      WHERE ${REVIEWED_EMPLOYEE_CONDITIONS}
        AND d.[fecha] BETWEEN CAST(@fecha_inicio AS date) AND CAST(@fecha_fin AS date)
      ORDER BY p.[codigo]`,
    buildPeriodParams(idSucursal, period),
  );
  return rows as { id_empleado: number; fecha: string; codigo: string }[];
}
