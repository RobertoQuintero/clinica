import { IScheduleDay, WeekdayNumber } from "@/interfaces/employee_schedule";
import { IAbsenceDetection } from "@/interfaces/payroll_absence";
import { weekdayOfDate } from "@/lib/payroll/overtimeDetection";

const FULL_WEEKDAY_NAMES: Record<WeekdayNumber, string> = {
  1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábado", 7: "domingo",
};

/** "2026-09-16" -> "miércoles". Opera sobre las partes numéricas, sin pasar por un `Date` local. */
export function formatIsoWeekday(fecha: string): string {
  return FULL_WEEKDAY_NAMES[weekdayOfDate(fecha)];
}

/** Siguiente día de un "YYYY-MM-DD", calculado en UTC para que no lo afecte la zona horaria. */
export function nextDate(fecha: string): string {
  const [year, month, day] = fecha.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/**
 * Espejo puro de la detección de faltas que hace el SQL del cálculo (donde manda el SQL).
 * Un día es falta si tiene horario, cae en [rangeStart, rangeEndExclusive) y no tiene ninguna checada
 * (una checada incompleta cuenta como asistencia).
 *
 * - `rangeStart` = max(fecha_inicio, fecha_ingreso).
 * - `rangeEndExclusive` = min(fecha_fin + 1, hoy): el día de hoy y los futuros nunca son falta.
 * - `checadaDates` = fechas "YYYY-MM-DD" que tienen al menos una checada.
 * Todas las fechas son strings y se comparan como strings.
 */
export function detectEmployeeAbsences(
  schedules: IScheduleDay[],
  checadaDates: Iterable<string>,
  rangeStart: string,
  rangeEndExclusive: string,
): IAbsenceDetection[] {
  if (schedules.length === 0) return [];

  const scheduleByWeekday = new Map(schedules.map((scheduleDay) => [scheduleDay.dia_semana, scheduleDay]));
  const datesWithCheckIn = new Set(checadaDates);
  const absences: IAbsenceDetection[] = [];

  for (let fecha = rangeStart; fecha < rangeEndExclusive; fecha = nextDate(fecha)) {
    const scheduledDay = scheduleByWeekday.get(weekdayOfDate(fecha));
    if (scheduledDay && !datesWithCheckIn.has(fecha)) {
      absences.push({ fecha, scheduledDay });
    }
  }
  return absences;
}
