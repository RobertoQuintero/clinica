import Link from "next/link";
import { ChevronRight, Info } from "lucide-react";
import type { IAbsenceFilters } from "@/interfaces/payroll_absence";
import { ABSENCE_STATUS_URL_VALUES, readAbsenceStatus } from "@/lib/payroll/absenceUrls";
import { readPositiveInteger, readSingleParam, type SearchParamsInput } from "@/lib/payroll/processUrls";
import EmployeesWithoutScheduleNotice from "../componentes/EmployeesWithoutScheduleNotice";
import PayrollEmptyState, { PAYROLL_LINK_BUTTON_CLASSES } from "../componentes/PayrollEmptyState";
import { PayrollStatusBadge } from "../periodos/componentes/PayrollBadges";
import { getAbsencePage } from "./actions";
import AbsenceDaysTable from "./componentes/AbsenceDaysTable";
import AbsenceSummaryCards from "./componentes/AbsenceSummaryCards";
import AbsenceToolbar from "./componentes/AbsenceToolbar";

export default async function AbsencesPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const rawSearchParams = await searchParams;

  const filters: IAbsenceFilters = {
    idPeriod: readPositiveInteger(readSingleParam(rawSearchParams, "periodo")),
    status: readAbsenceStatus(readSingleParam(rawSearchParams, "estado")),
    search: readSingleParam(rawSearchParams, "q").trim(),
    page: readPositiveInteger(readSingleParam(rawSearchParams, "pagina")) ?? 1,
  };

  const result = await getAbsencePage(filters);

  // Filtros vigentes de la URL (sin `pagina`) para que la paginación los conserve.
  const currentSearchParams: Record<string, string> = {};
  if (filters.idPeriod !== null) currentSearchParams.periodo = String(filters.idPeriod);
  if (filters.status !== "all") currentSearchParams.estado = ABSENCE_STATUS_URL_VALUES[filters.status];
  if (filters.search) currentSearchParams.q = filters.search;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-1.5 text-sm text-[#44474f] dark:text-zinc-400">
          <span>Nómina</span>
          <ChevronRight size={14} />
          <span className="font-medium text-[#0b1c30] dark:text-zinc-100">Faltas</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-1 mb-1">
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">Faltas</h2>
          {result.ok && result.data.period && <PayrollStatusBadge status={result.data.period.status} />}
        </div>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Días laborales sin ninguna checada de los podólogos, detectados con su horario.
        </p>
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-[#0051d5]/20 bg-[#0051d5]/5 dark:border-blue-800 dark:bg-blue-900/20 px-4 py-3 text-sm text-[#00174b] dark:text-blue-200">
        <Info size={18} className="shrink-0 mt-0.5 text-[#0051d5] dark:text-blue-300" aria-hidden />
        Las faltas injustificadas se descuentan de los días pagados al calcular la nómina del periodo. Revisa esta lista
        antes de calcular.
      </p>

      {!result.ok ? (
        <p role="alert" className="rounded-xl border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 px-4 py-3 text-sm text-[#ba1a1a] dark:text-red-400">
          {result.message}
        </p>
      ) : !result.data.period ? (
        result.data.periodOptions.length === 0 ? (
          <PayrollEmptyState
            title="Esta sucursal aún no tiene periodos de nómina"
            description="Crea un periodo para revisar las faltas de sus empleados."
            action={
              <Link href="/dashboard/nomina/periodos" className={PAYROLL_LINK_BUTTON_CLASSES}>
                Ir a Periodos de Nómina
              </Link>
            }
          />
        ) : (
          <PayrollEmptyState
            title="No encontramos ese periodo en esta sucursal"
            description="Puede pertenecer a otra sucursal o haberse eliminado."
            action={
              <Link href="/dashboard/nomina/faltas" className={PAYROLL_LINK_BUTTON_CLASSES}>
                Ver el periodo actual
              </Link>
            }
          />
        )
      ) : (
        <>
          <AbsenceToolbar
            periodOptions={result.data.periodOptions}
            selectedPeriodId={result.data.period.id_period}
            selectedStatus={filters.status}
            searchText={filters.search}
          />
          <AbsenceSummaryCards summary={result.data.summary} />
          <EmployeesWithoutScheduleNotice
            employees={result.data.employeesWithoutSchedule}
            undetectableSubject="sus faltas"
          />
          <AbsenceDaysTable
            rows={result.data.rows}
            totalRows={result.data.totalRows}
            page={filters.page}
            hasActiveFilters={filters.status !== "all" || filters.search !== ""}
            canDecide={result.data.canDecide}
            idPeriod={result.data.period.id_period}
            currentSearchParams={currentSearchParams}
          />
        </>
      )}
    </div>
  );
}
