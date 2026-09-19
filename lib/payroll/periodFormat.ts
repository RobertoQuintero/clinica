const SHORT_MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function splitDateString(dateString: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateString.split("-").map(Number);
  return { year, month, day };
}

/** "2026-09-14" -> "14 sep 2026". Opera sobre el string, sin pasar por `Date` (evita el corrimiento por UTC). */
export function formatPeriodDate(dateString: string): string {
  const { year, month, day } = splitDateString(dateString);
  return `${day} ${SHORT_MONTH_NAMES[month - 1]} ${year}`;
}

/** "2026-09-14" -> "14 sep". */
export function formatPeriodDayMonth(dateString: string): string {
  const { month, day } = splitDateString(dateString);
  return `${day} ${SHORT_MONTH_NAMES[month - 1]}`;
}

/** "14 sep – 20 sep 2026"; si el rango cruza de año, muestra el año en ambos extremos. */
export function formatPeriodRange(startDate: string, endDate: string): string {
  const start = splitDateString(startDate);
  const end = splitDateString(endDate);
  if (start.year !== end.year) {
    return `${formatPeriodDate(startDate)} – ${formatPeriodDate(endDate)}`;
  }
  return `${start.day} ${SHORT_MONTH_NAMES[start.month - 1]} – ${end.day} ${SHORT_MONTH_NAMES[end.month - 1]} ${end.year}`;
}

/** Días (con signo) de `fromDate` a `toDate`, ambos "YYYY-MM-DD". */
export function daysFromTo(fromDate: string, toDate: string): number {
  const from = splitDateString(fromDate);
  const to = splitDateString(toDate);
  return Math.round(
    (Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) / 86_400_000,
  );
}
