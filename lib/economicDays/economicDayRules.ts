// Reglas puras de días económicos (spec 79): se importan desde cliente y servidor.
import type { IEconomicDay, IEconomicDaysYear } from "@/interfaces/economic_day";
import { getIsoWeekday } from "@/lib/vacations/vacationDates";

export const ECONOMIC_DAYS_PER_YEAR = 3;

/** Rango del año calendario: `fecha >= start AND fecha < endExclusive`. */
export const getCalendarYearRange = (year: number): { start: string; endExclusive: string } => ({
  start: `${String(year).padStart(4, "0")}-01-01`,
  endExclusive: `${String(year + 1).padStart(4, "0")}-01-01`,
});

/**
 * Agrupa los días por año de `fecha`, del más reciente al más antiguo. Siempre incluye
 * `currentYear`, aunque no tenga días. Dentro de cada año, ordenados por fecha.
 */
export const groupEconomicDaysByYear = (
  days: IEconomicDay[],
  currentYear: number,
): IEconomicDaysYear[] => {
  const daysByYear = new Map<number, IEconomicDay[]>([[currentYear, []]]);
  for (const economicDay of days) {
    const year = Number(economicDay.fecha.slice(0, 4));
    const yearDays = daysByYear.get(year);
    if (yearDays) yearDays.push(economicDay);
    else daysByYear.set(year, [economicDay]);
  }

  return [...daysByYear.entries()]
    .sort(([yearA], [yearB]) => yearB - yearA)
    .map(([year, yearDays]) => {
      const sortedDays = [...yearDays].sort((a, b) => a.fecha.localeCompare(b.fecha));
      const usedDays = sortedDays.filter((economicDay) => economicDay.cancelado_at === null).length;
      return {
        year,
        usedDays,
        availableDays: Math.max(0, ECONOMIC_DAYS_PER_YEAR - usedDays),
        days: sortedDays,
      };
    });
};

/** `true` si `fecha` ("YYYY-MM-DD") cae en un día laborable del horario (1 = lunes … 7 = domingo). */
export const isWorkingDate = (fecha: string, workingIsoWeekdays: number[]): boolean =>
  workingIsoWeekdays.includes(getIsoWeekday(fecha));
