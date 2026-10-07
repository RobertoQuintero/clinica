import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Info } from "lucide-react";
import type { IShiftExtensionFilters } from "@/interfaces/payroll_shift_extension_bonus";
import {
  BONUS_KIND_URL_VALUES,
  SHIFT_EXTENSION_ASSIGNMENT_URL_VALUES,
  readShiftExtensionAssignmentFilter,
} from "@/lib/payroll/bonusUrls";
import { readPositiveInteger, readSingleParam, type SearchParamsInput } from "@/lib/payroll/processUrls";
import EmployeesWithoutScheduleNotice from "../../componentes/EmployeesWithoutScheduleNotice";
import PayrollEmptyState, { PAYROLL_LINK_BUTTON_CLASSES } from "../../componentes/PayrollEmptyState";
import PayrollRecalculationNotice from "../../componentes/PayrollRecalculationNotice";
import { PayrollStatusBadge } from "../../periodos/componentes/PayrollBadges";
import { getShiftExtensionAssignmentsLog, getShiftExtensionBonusPage } from "../actions";
import ShiftExtensionAssignmentsLog from "./ShiftExtensionAssignmentsLog";
import ShiftExtensionEmployeesTable from "./ShiftExtensionEmployeesTable";
import ShiftExtensionSummaryCards from "./ShiftExtensionSummaryCards";
import ShiftExtensionToolbar from "./ShiftExtensionToolbar";

interface Props {
  rawSearchParams: SearchParamsInput;
  /** Pestañas del selector de bono; la vista las muestra justo debajo de su encabezado. */
  kindTabs: ReactNode;
}

export default async function ShiftExtensionBonusView({ rawSearchParams, kindTabs }: Props) {
  const filters: IShiftExtensionFilters = {
    idPeriod: readPositiveInteger(readSingleParam(rawSearchParams, "periodo")),
    assignment: readShiftExtensionAssignmentFilter(readSingleParam(rawSearchParams, "asignacion")),
    search: readSingleParam(rawSearchParams, "q").trim(),
    page: readPositiveInteger(readSingleParam(rawSearchParams, "pagina")) ?? 1,
  };

  const [result, assignmentsLogResult] = await Promise.all([
    getShiftExtensionBonusPage(filters),
    getShiftExtensionAssignmentsLog(),
  ]);

  // Filtros vigentes de la URL (sin `pagina`) para que la paginación los conserve, incluido el bono.
  const currentSearchParams: Record<string, string> = { bono: BONUS_KIND_URL_VALUES.shift_extension };
  if (filters.idPeriod !== null) currentSearchParams.periodo = String(filters.idPeriod);
  if (filters.assignment !== "all") {
    currentSearchParams.asignacion = SHIFT_EXTENSION_ASSIGNMENT_URL_VALUES[filters.assignment];
  }
  if (filters.search) currentSearchParams.q = filters.search;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-1.5 text-sm text-[#44474f] dark:text-zinc-400">
          <span>Nómina</span>
          <ChevronRight size={14} />
          <span className="font-medium text-[#0b1c30] dark:text-zinc-100">Bonos</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-1 mb-1">
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">Bono por extensión de jornada</h2>
          {result.ok && result.data.period && <PayrollStatusBadge status={result.data.period.status} />}
        </div>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Los podólogos asignados cobran una hora doble por cada día con horario en el que checaron.
        </p>
      </div>

      {kindTabs}

      <p className="flex items-start gap-2 rounded-xl border border-[#0051d5]/20 bg-[#0051d5]/5 dark:border-blue-800 dark:bg-blue-900/20 px-4 py-3 text-sm text-[#00174b] dark:text-blue-200">
        <Info size={18} className="shrink-0 mt-0.5 text-[#0051d5] dark:text-blue-300" aria-hidden />
        El importe estimado usa el salario diario actual. Al calcular la nómina se guarda el importe definitivo.
      </p>

      {!result.ok ? (
        <p role="alert" className="rounded-xl border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 px-4 py-3 text-sm text-[#ba1a1a] dark:text-red-400">
          {result.message}
        </p>
      ) : !result.data.period ? (
        result.data.periodOptions.length === 0 ? (
          <PayrollEmptyState
            title="Esta sucursal aún no tiene periodos de nómina"
            description="Crea un periodo para revisar el bono por extensión de jornada de sus podólogos."
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
              <Link href="/dashboard/nomina/bonos?bono=extension" className={PAYROLL_LINK_BUTTON_CLASSES}>
                Ver el periodo actual
              </Link>
            }
          />
        )
      ) : (
        <>
          <ShiftExtensionToolbar
            periodOptions={result.data.periodOptions}
            selectedPeriodId={result.data.period.id_period}
            selectedAssignment={filters.assignment}
            searchText={filters.search}
          />
          <ShiftExtensionSummaryCards summary={result.data.summary} />
          <PayrollRecalculationNotice
            recalculationNeeded={result.data.recalculationNeeded}
            message="Hay bonos por extensión de jornada que no coinciden con el último cálculo. Recalcula la nómina."
          />
          <EmployeesWithoutScheduleNotice
            employees={result.data.employeesWithoutSchedule}
            undetectableSubject="sus días trabajados"
          />
          <ShiftExtensionEmployeesTable
            rows={result.data.rows}
            totalRows={result.data.totalRows}
            page={filters.page}
            hasActiveFilters={filters.assignment !== "all" || filters.search !== ""}
            currentSearchParams={currentSearchParams}
          />
          {assignmentsLogResult.ok && <ShiftExtensionAssignmentsLog entries={assignmentsLogResult.data} />}
        </>
      )}
    </div>
  );
}
