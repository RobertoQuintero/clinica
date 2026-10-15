import { notFound } from "next/navigation";
import { getEmployeeById } from "@/app/dashboard/empleados/actions";
import EmployeeWithoutScheduleNotice from "@/app/dashboard/empleados/[id]/componentes/EmployeeWithoutScheduleNotice";
import { getEmployeeWorkingWeekdays } from "@/app/dashboard/empleados/[id]/vacaciones/actions";
import { groupEconomicDaysByYear } from "@/lib/economicDays/economicDayRules";
import { addZeroToday } from "@/utils/date_helpper";
import { getEmployeeEconomicDays } from "./actions";
import EconomicDaysCurrentYearCard from "./componentes/EconomicDaysCurrentYearCard";
import EconomicDaysHistory from "./componentes/EconomicDaysHistory";
import RegisterEconomicDayModal from "./componentes/RegisterEconomicDayModal";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EmployeeEconomicDaysPage({ params }: Props) {
  const { id } = await params;
  const id_empleado = Number(id);
  if (!Number.isInteger(id_empleado) || id_empleado <= 0) notFound();

  const employee = await getEmployeeById(id_empleado);
  if (!employee) notFound();

  const [economicDays, workingWeekdays] = await Promise.all([
    getEmployeeEconomicDays(id_empleado),
    getEmployeeWorkingWeekdays(id_empleado),
  ]);

  const currentYear = Number(addZeroToday(new Date()).slice(0, 4));
  const [currentYearSummary, ...previousYears] = groupEconomicDaysByYear(economicDays, currentYear);
  const hasSchedule = workingWeekdays.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">Días económicos</h2>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Hasta 3 días por año calendario, en días laborables. El saldo se reinicia cada 1 de enero.
        </p>
      </div>

      {!hasSchedule && (
        <EmployeeWithoutScheduleNotice
          id_empleado={id_empleado}
          blockedAction="registrar un día económico, porque solo puede caer en un día laborable"
        />
      )}

      <EconomicDaysCurrentYearCard
        yearSummary={currentYearSummary}
        registerAction={
          employee.activo ? (
            <RegisterEconomicDayModal
              id_empleado={id_empleado}
              employeeName={employee.nombre_completo}
              currentYear={currentYear}
              availableDays={currentYearSummary.availableDays}
              workingWeekdays={workingWeekdays}
              isDisabled={!hasSchedule || currentYearSummary.availableDays === 0}
              disabledReason={
                !hasSchedule ? "Sin horario definido" : "No quedan días económicos disponibles"
              }
            />
          ) : undefined
        }
      />
      <EconomicDaysHistory previousYears={previousYears} />
    </div>
  );
}
