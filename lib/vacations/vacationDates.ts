// Aritmética de fechas "YYYY-MM-DD" sin pasar por new Date(string): se trabaja con
// números y Date.UTC solo como calendario, así no hay corrimiento de zona horaria.
// Los recortes replican DATEADD de SQL Server (29-feb → 28-feb, día 31 → fin de mes).

const MAXIMUM_VACATION_SCAN_DAYS = 800;

interface IDateParts {
  year: number;
  month: number; // 1-12
  day: number;
}

const parseIsoDate = (isoDate: string): IDateParts => {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return { year, month, day };
};

const formatIsoDate = ({ year, month, day }: IDateParts): string =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const getDaysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

export const addYearsClamped = (isoDate: string, years: number): string => {
  const { year, month, day } = parseIsoDate(isoDate);
  const targetYear = year + years;
  return formatIsoDate({
    year: targetYear,
    month,
    day: Math.min(day, getDaysInMonth(targetYear, month)),
  });
};

export const addMonthsClamped = (isoDate: string, months: number): string => {
  const { year, month, day } = parseIsoDate(isoDate);
  const zeroBasedTotal = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(zeroBasedTotal / 12);
  const targetMonth = (zeroBasedTotal % 12) + 1;
  return formatIsoDate({
    year: targetYear,
    month: targetMonth,
    day: Math.min(day, getDaysInMonth(targetYear, targetMonth)),
  });
};

export const addDays = (isoDate: string, days: number): string => {
  const { year, month, day } = parseIsoDate(isoDate);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return formatIsoDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
};

/** Día ISO de la semana: 1 = lunes … 7 = domingo. */
export const getIsoWeekday = (isoDate: string): number => {
  const { year, month, day } = parseIsoDate(isoDate);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
};

/**
 * Último día de vacaciones: cuenta `daysTaken` días laborables a partir de `startDate`
 * (inclusive) y salta los días de descanso. Si `startDate` cae en descanso, el primer
 * día contado es el siguiente laborable. Devuelve `null` si no hay días laborables
 * o `daysTaken` no es válido.
 */
export const calculateVacationEndDate = (
  startDate: string,
  daysTaken: number,
  workingIsoWeekdays: number[],
): string | null => {
  if (!Number.isInteger(daysTaken) || daysTaken < 1) return null;
  const workingWeekdays = new Set(workingIsoWeekdays);
  if (workingWeekdays.size === 0) return null;

  let currentDate = startDate;
  let countedDays = 0;
  for (let scanned = 0; scanned < MAXIMUM_VACATION_SCAN_DAYS; scanned++) {
    if (workingWeekdays.has(getIsoWeekday(currentDate))) {
      countedDays++;
      if (countedDays === daysTaken) return currentDate;
    }
    currentDate = addDays(currentDate, 1);
  }
  return null;
};

/**
 * Primer aniversario de `hireDate` posterior a `today` (los dos como "YYYY-MM-DD").
 * Para quien aún no cumple un año es la fecha de "Primer derecho".
 */
export const getNextAnniversary = (hireDate: string, today: string): string => {
  let anniversaryYear = 1;
  let anniversary = addYearsClamped(hireDate, anniversaryYear);
  while (anniversary <= today) {
    anniversaryYear++;
    anniversary = addYearsClamped(hireDate, anniversaryYear);
  }
  return anniversary;
};
