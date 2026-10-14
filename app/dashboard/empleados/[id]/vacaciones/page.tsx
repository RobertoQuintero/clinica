import Link from "next/link";
import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { getEmployeeById } from "@/app/dashboard/empleados/actions";
import { syncVacationEntitlements } from "@/lib/vacations/entitlementSync";
import { getNextAnniversary } from "@/lib/vacations/vacationDates";
import { formatIsoDateForDisplay } from "@/lib/vacations/vacationFormatting";
import { addZeroToday } from "@/utils/date_helpper";
import { getEmployeeVacations, getEmployeeWorkingWeekdays } from "./actions";
import VacationCurrentYearCard from "./componentes/VacationCurrentYearCard";
import VacationHistoryTable from "./componentes/VacationHistoryTable";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EmployeeVacationsPage({ params }: Props) {
  const { id } = await params;
  const id_empleado = Number(id);
  if (!Number.isInteger(id_empleado) || id_empleado <= 0) notFound();

  const employee = await getEmployeeById(id_empleado);
  if (!employee) notFound();

  // Genera los años que falten antes de leer; si falla, se muestra lo que ya existe.
  await syncVacationEntitlements(employee.id_empresa, id_empleado);

  const [entitlements, workingWeekdays] = await Promise.all([
    getEmployeeVacations(id_empleado),
    getEmployeeWorkingWeekdays(id_empleado),
  ]);

  const today = addZeroToday(new Date());
  const [currentEntitlement] = entitlements;
  const hasSchedule = workingWeekdays.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">Vacaciones</h2>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Un año de derecho por aniversario, con un único bloque continuo de días. Los días no
          disfrutados quedan por pagar.
        </p>
      </div>

      {!hasSchedule && (
        <section
          aria-label="Sin horario definido"
          className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex gap-3"
        >
          <TriangleAlert size={20} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Sin horario definido
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-300/90 mt-0.5">
              Sin horario no se puede capturar un bloque de vacaciones, porque la fecha de regreso
              se calcula con los días laborables.{" "}
              <Link
                href={`/dashboard/empleados/${id_empleado}/horario`}
                className="font-semibold underline underline-offset-2"
              >
                Captura el horario
              </Link>
              .
            </p>
          </div>
        </section>
      )}

      {currentEntitlement ? (
        <>
          <VacationCurrentYearCard entitlement={currentEntitlement} today={today} />
          <VacationHistoryTable entitlements={entitlements} />
        </>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl px-5 py-10 text-center shadow-sm">
          {employee.fecha_ingreso && employee.activo ? (
            <>
              <p className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-50">
                Primer derecho: {formatIsoDateForDisplay(getNextAnniversary(employee.fecha_ingreso, today))}
              </p>
              <p className="text-sm text-[#44474f] dark:text-zinc-400 mt-1">
                El empleado genera su primer año de vacaciones al cumplir un año de servicio.
              </p>
            </>
          ) : (
            <p className="text-sm text-[#44474f] dark:text-zinc-400">
              Este empleado no tiene años de vacaciones registrados.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
