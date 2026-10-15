import { getIsoWeekday } from "@/lib/vacations/vacationDates";
import { formatIsoDateForDisplay } from "@/lib/vacations/vacationFormatting";

const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** "YYYY-MM-DD" → "miércoles 21/10/2026" (sin Date, no hay corrimiento de zona horaria). */
export const formatEconomicDayDate = (isoDate: string): string =>
  `${WEEKDAY_NAMES[getIsoWeekday(isoDate) - 1]} ${formatIsoDateForDisplay(isoDate)}`;
