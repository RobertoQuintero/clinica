import { summarizeAttendanceEvents } from "@/app/dashboard/empleados/[id]/asistencia/attendancePairing";
import { IAttendanceEvent } from "@/interfaces/asistencia";
import { IScheduleDay, WeekdayNumber } from "@/interfaces/employee_schedule";
import { IOvertimeDetection } from "@/interfaces/payroll_overtime";

const MINUTES_PER_HALF_HOUR = 30;

/** "HH:mm" o "HH:mm:ss" → minutos desde medianoche, sin construir ningún Date. */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** Extrae "HH:mm" de un fecha_hora "YYYY-MM-DD HH:mm:ss". */
function extractTimePart(fechaHora: string): string {
  return fechaHora.slice(11, 16);
}

/** Redondea hacia abajo a bloques de 30 minutos y regresa horas (2 h 17 min → 2.0). */
export function roundDownToHalfHour(minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.floor(minutes / MINUTES_PER_HALF_HOUR) / 2;
}

/** Día de la semana ISO (1 = lunes … 7 = domingo) de un "YYYY-MM-DD", desde sus partes numéricas. */
export function weekdayOfDate(fecha: string): WeekdayNumber {
  const [year, month, day] = fecha.split("-").map(Number);
  const jsWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = domingo
  return (jsWeekday === 0 ? 7 : jsWeekday) as WeekdayNumber;
}

/**
 * Detecta las horas extra de un empleado entre fromDate y toDate (inclusive) comparando
 * sus checadas contra su horario semanal. Regresa solo los días con extra detectada o con
 * checada incompleta; [] si el empleado no tiene horario. Función pura, sin acceso a BD.
 */
export function detectEmployeeOvertime(
  schedule: IScheduleDay[],
  events: IAttendanceEvent[],
  fromDate: string,
  toDate: string
): IOvertimeDetection[] {
  if (schedule.length === 0) return [];

  const scheduleByWeekday = new Map<number, IScheduleDay>(
    schedule.map((scheduleDay) => [scheduleDay.dia_semana, scheduleDay])
  );

  const eventsByDate = new Map<string, IAttendanceEvent[]>();
  for (const event of events) {
    const fecha = event.fecha_hora.slice(0, 10);
    if (fecha < fromDate || fecha > toDate) continue;
    const dayEvents = eventsByDate.get(fecha);
    if (dayEvents) dayEvents.push(event);
    else eventsByDate.set(fecha, [event]);
  }

  const detections: IOvertimeDetection[] = [];

  for (const [fecha, unsortedDayEvents] of eventsByDate) {
    const dayEvents = [...unsortedDayEvents].sort((first, second) =>
      first.fecha_hora.localeCompare(second.fecha_hora)
    );

    const checkIns = dayEvents.filter((event) => event.tipo === "entrada");
    const checkOuts = dayEvents.filter((event) => event.tipo === "salida");
    const firstCheckIn = checkIns.length > 0 ? extractTimePart(checkIns[0].fecha_hora) : null;
    const lastCheckOut =
      checkOuts.length > 0 ? extractTimePart(checkOuts[checkOuts.length - 1].fecha_hora) : null;

    const scheduledDay = scheduleByWeekday.get(weekdayOfDate(fecha)) ?? null;
    const isIncomplete =
      summarizeAttendanceEvents(dayEvents).dayStatuses.get(fecha) === "incomplete";

    let detectedHours = 0;
    if (!isIncomplete && firstCheckIn !== null && lastCheckOut !== null) {
      const firstCheckInMinutes = timeToMinutes(firstCheckIn);
      const lastCheckOutMinutes = timeToMinutes(lastCheckOut);
      let overtimeMinutes: number;
      if (scheduledDay) {
        const scheduledEnd = scheduledDay.hora_salida_2 ?? scheduledDay.hora_salida_1;
        overtimeMinutes =
          Math.max(0, timeToMinutes(scheduledDay.hora_entrada_1) - firstCheckInMinutes) +
          Math.max(0, lastCheckOutMinutes - timeToMinutes(scheduledEnd));
      } else {
        overtimeMinutes = lastCheckOutMinutes - firstCheckInMinutes;
      }
      detectedHours = roundDownToHalfHour(overtimeMinutes);
    }

    if (detectedHours > 0 || isIncomplete) {
      detections.push({ fecha, scheduledDay, firstCheckIn, lastCheckOut, isIncomplete, detectedHours });
    }
  }

  return detections.sort((first, second) => first.fecha.localeCompare(second.fecha));
}
