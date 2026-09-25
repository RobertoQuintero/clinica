import type { IScheduleDay, WeekdayNumber } from "@/interfaces/employee_schedule";
import { formatPeriodDayMonth } from "@/lib/payroll/periodFormat";

const SHORT_WEEKDAY_NAMES: Record<WeekdayNumber, string> = {
  1: "lun", 2: "mar", 3: "mié", 4: "jue", 5: "vie", 6: "sáb", 7: "dom",
};

/** 2.5 -> "2.5 h"; 3 -> "3 h". */
export function formatOvertimeHours(hours: number): string {
  return `${hours} h`;
}

/** "2026-09-15" + lunes -> "lun 15 sep". Opera sobre el string, sin pasar por `Date`. */
export function formatOvertimeDate(fecha: string, weekday: WeekdayNumber): string {
  return `${SHORT_WEEKDAY_NAMES[weekday]} ${formatPeriodDayMonth(fecha)}`;
}

/** "09:00–18:00", o "09:00–14:00 · 16:00–20:00" con turno partido. */
export function formatScheduledDay(scheduledDay: IScheduleDay): string {
  const firstBlock = `${scheduledDay.hora_entrada_1}–${scheduledDay.hora_salida_1}`;
  if (scheduledDay.hora_entrada_2 && scheduledDay.hora_salida_2) {
    return `${firstBlock} · ${scheduledDay.hora_entrada_2}–${scheduledDay.hora_salida_2}`;
  }
  return firstBlock;
}
