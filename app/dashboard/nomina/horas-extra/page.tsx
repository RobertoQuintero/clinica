import Link from "next/link";
import { CalendarX2, ChevronRight, Info } from "lucide-react";
import type { IOvertimeFilters } from "@/interfaces/payroll_overtime";
import { readOvertimeStatus, OVERTIME_STATUS_URL_VALUES } from "@/lib/payroll/overtimeUrls";
import { readPositiveInteger, readSingleParam, type SearchParamsInput } from "@/lib/payroll/processUrls";
import { PayrollStatusBadge } from "../periodos/componentes/PayrollBadges";
import { getOvertimePage, getOvertimeSettingsLog } from "./actions";
import OvertimeRecalculationNotice from "../componentes/OvertimeRecalculationNotice";
import EmployeesWithoutScheduleNotice from "./componentes/EmployeesWithoutScheduleNotice";
import OvertimeDaysTable from "./componentes/OvertimeDaysTable";
import OvertimeSettingsCard from "./componentes/OvertimeSettingsCard";
import OvertimeSettingsLog from "./componentes/OvertimeSettingsLog";
import { EditOvertimeSettingsButton } from "./componentes/OvertimeSettingsModal";
import OvertimeSummaryCards from "./componentes/OvertimeSummaryCards";
import OvertimeToolbar from "./componentes/OvertimeToolbar";

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-zinc-900 border border-dashed border-[#c4c6d0] dark:border-zinc-700 rounded-xl px-6 py-12 flex flex-col items-center text-center gap-3">
      <span className="w-12 h-12 rounded-full bg-[#eff4ff] dark:bg-zinc-800 flex items-center justify-center text-[#747780] dark:text-zinc-500">
        <CalendarX2 size={22} />
      </span>
      <div>
        <h3 className="text-base font-semibold text-[#0b1c30] dark:text-zinc-100">{title}</h3>
        <p className="text-sm text-[#44474f] dark:text-zinc-400 mt-1 max-w-md">{description}</p>
      </div>
      {action}
    </section>
  );
}

const LINK_BUTTON_CLASSES =
  "inline-flex items-center gap-2 rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003ea7] transition-colors";

export default async function OvertimePage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const rawSearchParams = await searchParams;

  const filters: IOvertimeFilters = {
    idPeriod: readPositiveInteger(readSingleParam(rawSearchParams, "periodo")),
    status: readOvertimeStatus(readSingleParam(rawSearchParams, "estado")),
    search: readSingleParam(rawSearchParams, "q").trim(),
    page: readPositiveInteger(readSingleParam(rawSearchParams, "pagina")) ?? 1,
  };

  const [result, settingsLogResult] = await Promise.all([getOvertimePage(filters), getOvertimeSettingsLog()]);

  // Filtros vigentes de la URL (sin `pagina`) para que la paginación los conserve.
  const currentSearchParams: Record<string, string> = {};
  if (filters.idPeriod !== null) currentSearchParams.periodo = String(filters.idPeriod);
  if (filters.status !== "all") currentSearchParams.estado = OVERTIME_STATUS_URL_VALUES[filters.status];
  if (filters.search) currentSearchParams.q = filters.search;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-1.5 text-sm text-[#44474f] dark:text-zinc-400">
          <span>Nómina</span>
          <ChevronRight size={14} />
          <span className="font-medium text-[#0b1c30] dark:text-zinc-100">Horas extra</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-1 mb-1">
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">Horas extra</h2>
          {result.ok && result.data.period && <PayrollStatusBadge status={result.data.period.status} />}
        </div>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Tiempo trabajado fuera del horario de cada empleado, detectado con sus checadas.
        </p>
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-[#0051d5]/20 bg-[#0051d5]/5 dark:border-blue-800 dark:bg-blue-900/20 px-4 py-3 text-sm text-[#00174b] dark:text-blue-200">
        <Info size={18} className="shrink-0 mt-0.5 text-[#0051d5] dark:text-blue-300" aria-hidden />
        Las horas autorizadas se pagan al calcular la nómina del periodo.
      </p>

      {result.ok && (
        <section aria-label="Límites de horas extra" className="flex flex-col gap-3">
          <OvertimeSettingsCard
            settings={result.data.settings}
            editAction={<EditOvertimeSettingsButton settings={result.data.settings} />}
          />
          {settingsLogResult.ok && <OvertimeSettingsLog entries={settingsLogResult.data} />}
        </section>
      )}

      {!result.ok ? (
        <p role="alert" className="rounded-xl border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 px-4 py-3 text-sm text-[#ba1a1a] dark:text-red-400">
          {result.message}
        </p>
      ) : !result.data.period ? (
        result.data.periodOptions.length === 0 ? (
          <EmptyState
            title="Esta sucursal aún no tiene periodos de nómina"
            description="Crea un periodo para revisar las horas extra de sus empleados."
            action={
              <Link href="/dashboard/nomina/periodos" className={LINK_BUTTON_CLASSES}>
                Ir a Periodos de Nómina
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="No encontramos ese periodo en esta sucursal"
            description="Puede pertenecer a otra sucursal o haberse eliminado."
            action={
              <Link href="/dashboard/nomina/horas-extra" className={LINK_BUTTON_CLASSES}>
                Ver el periodo actual
              </Link>
            }
          />
        )
      ) : (
        <>
          <OvertimeToolbar
            periodOptions={result.data.periodOptions}
            selectedPeriodId={result.data.period.id_period}
            selectedStatus={filters.status}
            searchText={filters.search}
          />
          <OvertimeSummaryCards summary={result.data.summary} />
          <OvertimeRecalculationNotice recalculationNeeded={result.data.recalculationNeeded} />
          <EmployeesWithoutScheduleNotice employees={result.data.employeesWithoutSchedule} />
          <OvertimeDaysTable
            rows={result.data.rows}
            totalRows={result.data.totalRows}
            page={filters.page}
            hasActiveFilters={filters.status !== "all" || filters.search !== ""}
            canDecide={result.data.canDecide}
            idPeriod={result.data.period.id_period}
            dailyCap={result.data.settings?.tope_horas_dia ?? null}
            currentSearchParams={currentSearchParams}
          />
        </>
      )}
    </div>
  );
}
