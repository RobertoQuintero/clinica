import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Info, TriangleAlert } from "lucide-react";
import type { IAttendanceBonusFilters } from "@/interfaces/payroll_attendance_bonus";
import { BONUS_KIND_URL_VALUES, BONUS_RESULT_URL_VALUES, readBonusResult } from "@/lib/payroll/bonusUrls";
import { readPositiveInteger, readSingleParam, type SearchParamsInput } from "@/lib/payroll/processUrls";
import EmployeesWithoutScheduleNotice from "../../componentes/EmployeesWithoutScheduleNotice";
import PayrollEmptyState, { PAYROLL_LINK_BUTTON_CLASSES } from "../../componentes/PayrollEmptyState";
import PayrollRecalculationNotice from "../../componentes/PayrollRecalculationNotice";
import { PayrollStatusBadge } from "../../periodos/componentes/PayrollBadges";
import { getAttendanceBonusPage, getAttendanceBonusSettingsLog } from "../actions";
import AttendanceBonusEmployeesTable from "./AttendanceBonusEmployeesTable";
import AttendanceBonusSummaryCards from "./AttendanceBonusSummaryCards";
import BonusResultToolbar from "./BonusResultToolbar";
import BonusSettingsCard from "./BonusSettingsCard";
import BonusSettingsLog from "./BonusSettingsLog";

const NOTICE_CLASSES =
  "rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex gap-3";

interface Props {
  rawSearchParams: SearchParamsInput;
  /** Pestañas del selector de bono; la vista las muestra justo debajo de su encabezado. */
  kindTabs: ReactNode;
}

export default async function AttendanceBonusView({ rawSearchParams, kindTabs }: Props) {
  const filters: IAttendanceBonusFilters = {
    idPeriod: readPositiveInteger(readSingleParam(rawSearchParams, "periodo")),
    result: readBonusResult(readSingleParam(rawSearchParams, "resultado")),
    search: readSingleParam(rawSearchParams, "q").trim(),
    page: readPositiveInteger(readSingleParam(rawSearchParams, "pagina")) ?? 1,
  };

  const [result, settingsLogResult] = await Promise.all([
    getAttendanceBonusPage(filters),
    getAttendanceBonusSettingsLog(),
  ]);

  // Filtros vigentes de la URL (sin `pagina`) para que la paginación los conserve, incluido el bono.
  const currentSearchParams: Record<string, string> = { bono: BONUS_KIND_URL_VALUES.attendance };
  if (filters.idPeriod !== null) currentSearchParams.periodo = String(filters.idPeriod);
  if (filters.result !== "all") currentSearchParams.resultado = BONUS_RESULT_URL_VALUES[filters.result];
  if (filters.search) currentSearchParams.q = filters.search;

  const periodSetting = result.ok ? result.data.periodSetting : null;
  const isBonusActiveForPeriod = periodSetting !== null && periodSetting.updated_at !== null && periodSetting.status;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-1.5 text-sm text-[#44474f] dark:text-zinc-400">
          <span>Nómina</span>
          <ChevronRight size={14} />
          <span className="font-medium text-[#0b1c30] dark:text-zinc-100">Bonos</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-1 mb-1">
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">Bonos de asistencia</h2>
          {result.ok && result.data.period && <PayrollStatusBadge status={result.data.period.status} />}
        </div>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Los podólogos que estuvieron el periodo completo cobran el bono si no tienen ninguna falta injustificada.
        </p>
      </div>

      {kindTabs}

      <p className="flex items-start gap-2 rounded-xl border border-[#0051d5]/20 bg-[#0051d5]/5 dark:border-blue-800 dark:bg-blue-900/20 px-4 py-3 text-sm text-[#00174b] dark:text-blue-200">
        <Info size={18} className="shrink-0 mt-0.5 text-[#0051d5] dark:text-blue-300" aria-hidden />
        Las faltas se justifican en Faltas. Revisa Faltas y esta lista antes de calcular, y recalcula después de que
        termine el periodo: las faltas solo cuentan hasta ayer.
      </p>

      {result.ok && (
        <section aria-label="Reglas del bono de asistencia" className="flex flex-col gap-3">
          <BonusSettingsCard bonusKind="attendance" settings={result.data.settings} />
          {settingsLogResult.ok && <BonusSettingsLog bonusKind="attendance" entries={settingsLogResult.data} />}
        </section>
      )}

      {!result.ok ? (
        <p role="alert" className="rounded-xl border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 px-4 py-3 text-sm text-[#ba1a1a] dark:text-red-400">
          {result.message}
        </p>
      ) : !result.data.period ? (
        result.data.periodOptions.length === 0 ? (
          <PayrollEmptyState
            title="Esta sucursal aún no tiene periodos de nómina"
            description="Crea un periodo para revisar el bono de asistencia de sus podólogos."
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
              <Link href="/dashboard/nomina/bonos?bono=asistencia" className={PAYROLL_LINK_BUTTON_CLASSES}>
                Ver el periodo actual
              </Link>
            }
          />
        )
      ) : (
        <>
          <BonusResultToolbar
            periodOptions={result.data.periodOptions}
            selectedPeriodId={result.data.period.id_period}
            selectedResult={filters.result}
            searchText={filters.search}
          />
          {!isBonusActiveForPeriod && (
            <section role="status" className={NOTICE_CLASSES}>
              <TriangleAlert size={20} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  {`Bono no configurado para ${periodSetting?.frequencyName ?? "esta frecuencia"}`}
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-300/90 mt-0.5">
                  Activa el bono de esta frecuencia en las reglas de arriba para que sus periodos lo paguen.
                </p>
              </div>
            </section>
          )}
          <AttendanceBonusSummaryCards summary={result.data.summary} />
          <PayrollRecalculationNotice
            recalculationNeeded={result.data.recalculationNeeded}
            message="Hay bonos de asistencia que no coinciden con el último cálculo. Recalcula la nómina."
          />
          <EmployeesWithoutScheduleNotice
            employees={result.data.employeesWithoutSchedule}
            undetectableSubject="sus faltas"
          />
          <AttendanceBonusEmployeesTable
            rows={result.data.rows}
            totalRows={result.data.totalRows}
            page={filters.page}
            hasActiveFilters={filters.result !== "all" || filters.search !== ""}
            idPeriod={result.data.period.id_period}
            currentSearchParams={currentSearchParams}
          />
        </>
      )}
    </div>
  );
}
