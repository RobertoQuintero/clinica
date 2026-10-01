import { IScheduleDay } from "@/interfaces/employee_schedule";
import {
  ILatenessDetection,
  ILatenessSettings,
  ILatenessTier,
  LatenessClassification,
} from "@/interfaces/payroll_lateness";
import { nextDate } from "@/lib/payroll/absenceDetection";
import { weekdayOfDate } from "@/lib/payroll/overtimeDetection";

type LatenessThresholds = Pick<ILatenessSettings, "tolerancia_minutos" | "minutos_retardo_grave">;

/** "08:00" o "08:00:59" -> segundos desde la medianoche. Opera sobre las partes numéricas, sin `Date`. */
function secondsOfDay(time: string): number {
  const [hours, minutes, seconds] = time.split(":").map(Number);
  return hours * 3600 + minutes * 60 + (seconds || 0);
}

/** Minutos completos entre la hora programada y la llegada; los segundos se truncan (08:09:59 son 9). */
export function calculateLatenessMinutes(scheduledEntry: string, arrival: string): number {
  return Math.floor((secondsOfDay(arrival) - secondsOfDay(scheduledEntry)) / 60);
}

/** Grave a partir de `minutos_retardo_grave`; si no, acumulable. Son excluyentes. */
export function classifyLateness(minutes: number, settings: LatenessThresholds): LatenessClassification {
  return minutes >= settings.minutos_retardo_grave ? "severe" : "accumulable";
}

/**
 * Espejo puro de la detección de retardos que hace el SQL del cálculo (donde manda el SQL).
 * Un día es retardo si tiene horario, cae en [rangeStart, rangeEndInclusive], tiene una primera
 * entrada y llegó más de `tolerancia_minutos` después de `hora_entrada_1` (spec 64: `minutos > tolerancia`).
 *
 * - `rangeStart` = max(fecha_inicio, fecha_ingreso).
 * - `rangeEndInclusive` = min(fecha_fin, hoy): el día de hoy sí se evalúa; los futuros no.
 * - `firstEntryByDate` = fecha "YYYY-MM-DD" -> hora de la primera checada `entrada` "HH:mm:ss".
 *   Un día sin entrada no se evalúa (sin checadas es asunto de Faltas).
 * Todas las fechas y horas son strings.
 */
export function detectEmployeeLateness(
  schedules: IScheduleDay[],
  firstEntryByDate: ReadonlyMap<string, string>,
  rangeStart: string,
  rangeEndInclusive: string,
  settings: LatenessThresholds,
): ILatenessDetection[] {
  if (schedules.length === 0) return [];

  const scheduleByWeekday = new Map(schedules.map((scheduleDay) => [scheduleDay.dia_semana, scheduleDay]));
  const latenessDays: ILatenessDetection[] = [];

  for (let fecha = rangeStart; fecha <= rangeEndInclusive; fecha = nextDate(fecha)) {
    const scheduledDay = scheduleByWeekday.get(weekdayOfDate(fecha));
    const arrival = firstEntryByDate.get(fecha);
    if (!scheduledDay || !arrival) continue;

    const minutos = calculateLatenessMinutes(scheduledDay.hora_entrada_1, arrival);
    if (minutos <= settings.tolerancia_minutos) continue;

    latenessDays.push({
      fecha,
      hora_entrada_1: scheduledDay.hora_entrada_1,
      hora_llegada: arrival,
      minutos,
      classification: classifyLateness(minutos, settings),
    });
  }
  return latenessDays;
}

/**
 * Días a descontar por retardos, sin tope (el tope `<= dias` lo aplica quien llama).
 * Los graves descuentan `severeDays` cada uno. Los acumulables usan los escalones de la frecuencia en ciclo:
 * ciclo = el `retardos` más alto; floor(A / ciclo) × días del escalón más alto
 * + días del escalón más alto con `retardos <= A mod ciclo` (0 si ninguno).
 * Sin escalones solo descuentan los graves.
 */
export function calculateLatenessDiscountDays(
  severeCount: number,
  accumulableCount: number,
  severeDays: number,
  tiers: Pick<ILatenessTier, "retardos" | "dias_descuento">[],
): number {
  const severeDiscount = severeCount * severeDays;
  if (tiers.length === 0 || accumulableCount <= 0) return severeDiscount;

  const sortedTiers = [...tiers].sort((first, second) => first.retardos - second.retardos);
  const highestTier = sortedTiers[sortedTiers.length - 1];
  const cycleLength = highestTier.retardos;

  const completeCycles = Math.floor(accumulableCount / cycleLength);
  const remainder = accumulableCount % cycleLength;
  const remainderTier = [...sortedTiers].reverse().find((tier) => tier.retardos <= remainder);

  const accumulableDiscount = completeCycles * highestTier.dias_descuento + (remainderTier?.dias_descuento ?? 0);
  return severeDiscount + accumulableDiscount;
}
