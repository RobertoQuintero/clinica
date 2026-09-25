import { IScheduleDay, WeekdayNumber } from "@/interfaces/employee_schedule";

/** Estado editable de un día en el modal. Las horas son "HH:mm" o "" si el input está vacío. */
export interface ScheduleDayDraft {
  works: boolean;
  entry1: string;
  exit1: string;
  hasSecondBlock: boolean;
  entry2: string;
  exit2: string;
}

export type ScheduleDrafts = Record<WeekdayNumber, ScheduleDayDraft>;

const WEEKDAYS: WeekdayNumber[] = [1, 2, 3, 4, 5, 6, 7];

export const DEFAULT_DAY_DRAFT: ScheduleDayDraft = {
  works: true,
  entry1: "09:00",
  exit1: "18:00",
  hasSecondBlock: false,
  entry2: "",
  exit2: "",
};

const REST_DAY_DRAFT: ScheduleDayDraft = { ...DEFAULT_DAY_DRAFT, works: false };

/**
 * Mismas reglas que saveEmployeeScheduleSchema (que es server-only y no llega al cliente):
 * devuelve el primer error del día o null. "HH:mm" del mismo largo se compara como string.
 */
export function validateDayDraft(draft: ScheduleDayDraft): string | null {
  if (!draft.works) return null;
  if (!draft.entry1 || !draft.exit1) return "Captura la entrada y la salida";
  if (draft.exit1 <= draft.entry1) return "La salida debe ser posterior a la entrada";
  if (!draft.hasSecondBlock) return null;

  if (!draft.entry2 || !draft.exit2) return "El segundo bloque necesita entrada y salida";
  if (draft.entry2 <= draft.exit1) {
    return "El segundo bloque debe empezar después de que termina el primero";
  }
  if (draft.exit2 <= draft.entry2) {
    return "La salida del segundo bloque debe ser posterior a su entrada";
  }
  return null;
}

/** Semana guardada → borradores editables; los días sin fila quedan como descanso. */
export function buildDraftsFromDays(days: IScheduleDay[]): ScheduleDrafts {
  const drafts = {} as ScheduleDrafts;
  for (const weekday of WEEKDAYS) {
    const day = days.find((scheduleDay) => scheduleDay.dia_semana === weekday);
    drafts[weekday] = day
      ? {
          works: true,
          entry1: day.hora_entrada_1,
          exit1: day.hora_salida_1,
          hasSecondBlock: day.hora_entrada_2 !== null,
          entry2: day.hora_entrada_2 ?? "",
          exit2: day.hora_salida_2 ?? "",
        }
      : REST_DAY_DRAFT;
  }
  return drafts;
}

/** Borradores → payload de saveEmployeeSchedule: solo los días marcados, ordenados. */
export function buildDaysFromDrafts(drafts: ScheduleDrafts): IScheduleDay[] {
  return WEEKDAYS.filter((weekday) => drafts[weekday].works).map((weekday) => {
    const draft = drafts[weekday];
    return {
      dia_semana: weekday,
      hora_entrada_1: draft.entry1,
      hora_salida_1: draft.exit1,
      hora_entrada_2: draft.hasSecondBlock ? draft.entry2 : null,
      hora_salida_2: draft.hasSecondBlock ? draft.exit2 : null,
    };
  });
}
