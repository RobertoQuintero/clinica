import { IScheduleDay, WeekdayNumber } from "@/interfaces/employee_schedule";
import {
  WEEKDAY_LABELS,
  calculateDayHours,
  formatDayBlocks,
  timeToMinutes,
} from "../scheduleFormatting";

interface Props {
  days: IScheduleDay[];
}

const WEEKDAYS: WeekdayNumber[] = [1, 2, 3, 4, 5, 6, 7];
const DEFAULT_AXIS_START_HOUR = 7;
const DEFAULT_AXIS_END_HOUR = 21;

/** Rango del eje horario: 07–21 h por defecto, ampliado si algún bloque cae fuera. */
function getAxisRange(days: IScheduleDay[]): { startMinutes: number; endMinutes: number } {
  let startMinutes = DEFAULT_AXIS_START_HOUR * 60;
  let endMinutes = DEFAULT_AXIS_END_HOUR * 60;
  for (const day of days) {
    startMinutes = Math.min(startMinutes, Math.floor(timeToMinutes(day.hora_entrada_1) / 60) * 60);
    const lastExit = day.hora_salida_2 ?? day.hora_salida_1;
    endMinutes = Math.max(endMinutes, Math.ceil(timeToMinutes(lastExit) / 60) * 60);
  }
  return { startMinutes, endMinutes };
}

function formatHours(hours: number): string {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(2).replace(/0$/, "")} h`;
}

/** Semana de lunes a domingo: bloques como texto y como barras sobre el eje horario del día. */
export default function ScheduleWeek({ days }: Props) {
  const dayByWeekday = new Map(days.map((day) => [day.dia_semana, day]));
  const { startMinutes, endMinutes } = getAxisRange(days);
  const axisSpan = endMinutes - startMinutes;

  const positionBlock = (entry: string, exit: string) => ({
    left: `${((timeToMinutes(entry) - startMinutes) / axisSpan) * 100}%`,
    width: `${((timeToMinutes(exit) - timeToMinutes(entry)) / axisSpan) * 100}%`,
  });

  return (
    <ul className="divide-y divide-[#c4c6d0] dark:divide-zinc-700">
      {WEEKDAYS.map((weekday) => {
        const day = dayByWeekday.get(weekday);
        const { long } = WEEKDAY_LABELS[weekday];

        return (
          <li
            key={weekday}
            className="grid grid-cols-[6.5rem_1fr] sm:grid-cols-[7rem_13rem_1fr_4rem] items-center gap-x-4 gap-y-2 px-5 py-3.5"
          >
            <span
              className={`text-sm font-semibold ${
                day ? "text-[#0b1c30] dark:text-zinc-50" : "text-[#74777f] dark:text-zinc-500"
              }`}
            >
              {long}
            </span>

            {day ? (
              <>
                <span className="text-sm tabular-nums text-[#0b1c30] dark:text-zinc-100">
                  {formatDayBlocks(day)}
                </span>
                <div
                  aria-hidden="true"
                  className="relative col-span-2 sm:col-span-1 h-2 rounded-full bg-[#eff4ff] dark:bg-zinc-800"
                >
                  <span
                    className="absolute inset-y-0 rounded-full bg-[#0051d5] dark:bg-blue-400"
                    style={positionBlock(day.hora_entrada_1, day.hora_salida_1)}
                  />
                  {day.hora_entrada_2 && day.hora_salida_2 && (
                    <span
                      className="absolute inset-y-0 rounded-full bg-[#0051d5] dark:bg-blue-400"
                      style={positionBlock(day.hora_entrada_2, day.hora_salida_2)}
                    />
                  )}
                </div>
                <span className="hidden sm:block text-right text-sm tabular-nums text-[#44474f] dark:text-zinc-400">
                  {formatHours(calculateDayHours(day))}
                </span>
              </>
            ) : (
              <span className="text-sm text-[#74777f] dark:text-zinc-500 sm:col-span-3">
                Descanso
              </span>
            )}
          </li>
        );
      })}
      <li
        aria-hidden="true"
        className="hidden sm:grid grid-cols-[7rem_13rem_1fr_4rem] gap-x-4 px-5 py-2 text-xs tabular-nums text-[#74777f] dark:text-zinc-500 bg-[#f8f9ff] dark:bg-zinc-900/60"
      >
        <span />
        <span />
        <span className="flex justify-between">
          <span>{String(startMinutes / 60).padStart(2, "0")}:00</span>
          <span>{String(endMinutes / 60).padStart(2, "0")}:00</span>
        </span>
        <span />
      </li>
    </ul>
  );
}
