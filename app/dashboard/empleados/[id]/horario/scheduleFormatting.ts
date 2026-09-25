import { IScheduleDay, WeekdayNumber } from "@/interfaces/employee_schedule";

/** 1..7 → nombre corto y largo del día (ISO: 1 = lunes). */
export const WEEKDAY_LABELS: Record<WeekdayNumber, { short: string; long: string }> = {
  1: { short: "Lun", long: "Lunes" },
  2: { short: "Mar", long: "Martes" },
  3: { short: "Mié", long: "Miércoles" },
  4: { short: "Jue", long: "Jueves" },
  5: { short: "Vie", long: "Viernes" },
  6: { short: "Sáb", long: "Sábado" },
  7: { short: "Dom", long: "Domingo" },
};

/** "HH:mm" → minutos desde medianoche. Aritmética sobre el string, sin Date. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Bloques de un día como texto: "09:00–14:00" o "09:00–14:00 y 16:00–20:00". */
export function formatDayBlocks(day: IScheduleDay): string {
  const firstBlock = `${day.hora_entrada_1}–${day.hora_salida_1}`;
  if (day.hora_entrada_2 && day.hora_salida_2) {
    return `${firstBlock} y ${day.hora_entrada_2}–${day.hora_salida_2}`;
  }
  return firstBlock;
}

/** Horas de un solo día, sumando sus bloques. */
export function calculateDayHours(day: IScheduleDay): number {
  let minutes = timeToMinutes(day.hora_salida_1) - timeToMinutes(day.hora_entrada_1);
  if (day.hora_entrada_2 && day.hora_salida_2) {
    minutes += timeToMinutes(day.hora_salida_2) - timeToMinutes(day.hora_entrada_2);
  }
  return minutes / 60;
}

/** Total de horas de la semana, con dos decimales. */
export function calculateWeeklyHours(days: IScheduleDay[]): number {
  const totalHours = days.reduce((total, day) => total + calculateDayHours(day), 0);
  return Math.round(totalHours * 100) / 100;
}

/** Une los días de un mismo grupo: los consecutivos como "Lun–Vie", el resto separados por coma. */
function formatDayRuns(weekdays: WeekdayNumber[]): string {
  const runs: WeekdayNumber[][] = [];
  for (const weekday of weekdays) {
    const currentRun = runs[runs.length - 1];
    if (currentRun && currentRun[currentRun.length - 1] === weekday - 1) {
      currentRun.push(weekday);
    } else {
      runs.push([weekday]);
    }
  }
  return runs
    .map((run) =>
      run.length === 1
        ? WEEKDAY_LABELS[run[0]].short
        : `${WEEKDAY_LABELS[run[0]].short}–${WEEKDAY_LABELS[run[run.length - 1]].short}`
    )
    .join(", ");
}

/**
 * Resumen compacto: agrupa los días con los mismos bloques, p. ej.
 * "Lun–Vie 09:00–18:00 · Sáb 09:00–14:00". Devuelve null si no hay días.
 */
export function formatScheduleSummary(days: IScheduleDay[]): string | null {
  if (days.length === 0) return null;

  const sortedDays = [...days].sort((a, b) => a.dia_semana - b.dia_semana);
  const weekdaysByBlocks = new Map<string, WeekdayNumber[]>();
  for (const day of sortedDays) {
    const blocksText = formatDayBlocks(day);
    const weekdays = weekdaysByBlocks.get(blocksText);
    if (weekdays) weekdays.push(day.dia_semana);
    else weekdaysByBlocks.set(blocksText, [day.dia_semana]);
  }

  return Array.from(weekdaysByBlocks, ([blocksText, weekdays]) =>
    `${formatDayRuns(weekdays)} ${blocksText}`
  ).join(" · ");
}
