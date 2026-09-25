import { notFound } from "next/navigation";
import { getEmployeeById } from "@/app/dashboard/empleados/actions";
import { getEmployeeSchedule } from "./actions";
import { calculateWeeklyHours } from "./scheduleFormatting";
import ScheduleWeek from "./componentes/ScheduleWeek";

interface Props {
  params: Promise<{ id: string }>;
}

/** "YYYY-MM-DD HH:mm:ss" → "DD/MM/YYYY HH:mm", recortando el string (sin Date). */
function formatUpdatedAt(updatedAt: string): string {
  const [datePart, timePart] = updatedAt.split(" ");
  const [year, month, day] = datePart.split("-");
  return `${day}/${month}/${year} ${timePart.slice(0, 5)}`;
}

export default async function EmployeeSchedulePage({ params }: Props) {
  const { id } = await params;
  const id_empleado = Number(id);
  if (!Number.isInteger(id_empleado) || id_empleado <= 0) notFound();

  const [employee, schedule] = await Promise.all([
    getEmployeeById(id_empleado),
    getEmployeeSchedule(id_empleado),
  ]);
  if (!employee) notFound();

  const hasSchedule = schedule.days.length > 0;
  const legacyText = [employee.dias_laborales, employee.horario]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">Horario</h2>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Días y horas de trabajo de la semana. Un día sin horario es día de descanso.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-[#c4c6d0] dark:border-zinc-700 flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-bold text-[#0b1c30] dark:text-zinc-50">Semana laboral</h3>
          {hasSchedule && (
            <span className="px-2 py-0.5 rounded-full bg-[#dbe1ff] dark:bg-blue-900/30 text-[#0043b0] dark:text-blue-400 text-xs font-semibold tabular-nums">
              {calculateWeeklyHours(schedule.days)} h por semana
            </span>
          )}
          {schedule.updated_at && (
            <span className="text-xs text-[#74777f] dark:text-zinc-500 sm:ml-auto">
              Actualizado el {formatUpdatedAt(schedule.updated_at)}
            </span>
          )}
        </div>

        {hasSchedule ? (
          <ScheduleWeek days={schedule.days} />
        ) : (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-50">
              Sin horario definido
            </p>
            <p className="text-sm text-[#44474f] dark:text-zinc-400 mt-1">
              Este empleado todavía no tiene días ni horas capturados.
            </p>
          </div>
        )}
      </div>

      {!hasSchedule && legacyText && (
        <div className="bg-[#f8f9ff] dark:bg-zinc-900 border border-dashed border-[#c4c6d0] dark:border-zinc-700 rounded-xl px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#74777f] dark:text-zinc-500 mb-1">
            Referencia anterior
          </p>
          <p className="text-sm text-[#0b1c30] dark:text-zinc-100">{legacyText}</p>
        </div>
      )}
    </div>
  );
}
