import type { IPayrollPeriodDates } from "@/interfaces/payroll_period";
import { PAYROLL_FREQUENCY_LETTER_BY_SAT_KEY } from "./constants";

const MILLISECONDS_PER_DAY = 86_400_000;
const FRIDAY = 5;

// Duración fija en días de las frecuencias que no se rigen por calendario (semanal, quincenal y mensual sí).
const FIXED_LENGTH_DAYS_BY_SAT_KEY: Record<string, number> = {
  "01": 1,
  "03": 14,
  "06": 60,
  "10": 10,
};

function parseDateString(dateString: string): number {
  const [year, month, day] = dateString.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatDateString(timestamp: number): string {
  const date = new Date(timestamp);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateString: string, days: number): string {
  return formatDateString(parseDateString(dateString) + days * MILLISECONDS_PER_DAY);
}

function daysBetween(fromDateString: string, toDateString: string): number {
  return Math.round((parseDateString(toDateString) - parseDateString(fromDateString)) / MILLISECONDS_PER_DAY);
}

function dayOfWeek(dateString: string): number {
  return new Date(parseDateString(dateString)).getUTCDay();
}

function lastDayOfMonth(dateString: string): string {
  const [year, month] = dateString.split("-").map(Number);
  return formatDateString(Date.UTC(year, month, 0));
}

function firstDaySuggestion(satKey: string, today: string): string {
  const dayOfMonth = Number(today.slice(8, 10));
  switch (satKey) {
    case "02":
      return addDays(today, -((dayOfWeek(today) + 6) % 7));
    case "04":
      return `${today.slice(0, 8)}${dayOfMonth < 16 ? "01" : "16"}`;
    case "05":
      return `${today.slice(0, 8)}01`;
    default:
      return today;
  }
}

function endDateSuggestion(satKey: string, startDate: string): string {
  switch (satKey) {
    case "02":
      return addDays(startDate, 6);
    case "04":
      return Number(startDate.slice(8, 10)) <= 15
        ? `${startDate.slice(0, 8)}15`
        : lastDayOfMonth(startDate);
    case "05":
      return lastDayOfMonth(startDate);
    default:
      return addDays(startDate, (FIXED_LENGTH_DAYS_BY_SAT_KEY[satKey] ?? 1) - 1);
  }
}

/** Sugiere las 4 fechas de un periodo nuevo. Todas las fechas son "YYYY-MM-DD". */
export function suggestPeriodDates(
  satKey: string,
  previousEndDate: string | null,
  today: string,
): IPayrollPeriodDates {
  const fecha_inicio = previousEndDate
    ? addDays(previousEndDate, 1)
    : firstDaySuggestion(satKey, today);
  const fecha_fin = endDateSuggestion(satKey, fecha_inicio);

  if (daysBetween(fecha_inicio, fecha_fin) + 1 < 7) {
    return { fecha_inicio, fecha_fin, fecha_corte: fecha_fin, fecha_pago: fecha_fin };
  }

  const daysSinceFriday = (dayOfWeek(fecha_fin) - FRIDAY + 7) % 7;
  const fecha_pago = addDays(fecha_fin, -daysSinceFriday);
  const cutoffCandidate = addDays(fecha_pago, -2);
  const fecha_corte = cutoffCandidate < fecha_inicio ? fecha_inicio : cutoffCandidate;

  return { fecha_inicio, fecha_fin, fecha_corte, fecha_pago };
}

/** Ejemplo: buildPeriodCode(2026, "02", 38) => "NOM-2026-S38". */
export function buildPeriodCode(ejercicio: number, satKey: string, consecutivo: number): string {
  const letter = PAYROLL_FREQUENCY_LETTER_BY_SAT_KEY[satKey];
  if (!letter) throw new Error(`Frecuencia SAT sin letra de código: ${satKey}`);
  return `NOM-${ejercicio}-${letter}${String(consecutivo).padStart(2, "0")}`;
}
