import Link from "next/link";
import { ChevronRight, Info, TriangleAlert } from "lucide-react";
import type { ILatenessFilters } from "@/interfaces/payroll_lateness";
import {
  LATENESS_CLASSIFICATION_URL_VALUES,
  LATENESS_STATUS_URL_VALUES,
  readLatenessClassification,
  readLatenessStatus,
} from "@/lib/payroll/latenessUrls";
import { readPositiveInteger, readSingleParam, type SearchParamsInput } from "@/lib/payroll/processUrls";
import EmployeesWithoutScheduleNotice from "../componentes/EmployeesWithoutScheduleNotice";
import PayrollEmptyState, { PAYROLL_LINK_BUTTON_CLASSES } from "../componentes/PayrollEmptyState";
import PayrollRecalculationNotice from "../componentes/PayrollRecalculationNotice";
import { PayrollStatusBadge } from "../periodos/componentes/PayrollBadges";
import { getLatenessPage, getLatenessSettingsLog } from "./actions";
import LatenessDaysTable from "./componentes/LatenessDaysTable";
import LatenessEmployeeSummaryTable from "./componentes/LatenessEmployeeSummaryTable";
import LatenessSettingsCard from "./componentes/LatenessSettingsCard";
import LatenessSettingsLog from "./componentes/LatenessSettingsLog";
import { EditLatenessSettingsButton } from "./componentes/LatenessSettingsModal";
import LatenessSummaryCards from "./componentes/LatenessSummaryCards";
import LatenessToolbar from "./componentes/LatenessToolbar";

const NOTICE_CLASSES =
  "rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex gap-3";

function LatenessWarning({ title, description }: { title: string; description: string }) {
  return (
    <section role="status" className={NOTICE_CLASSES}>
      <TriangleAlert size={20} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{title}</p>
        <p className="text-sm text-amber-800 dark:text-amber-300/90 mt-0.5">{description}</p>
      </div>
    </section>
  );
}

export default async function LatenessPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const rawSearchParams = await searchParams;

  const filters: ILatenessFilters = {
    idPeriod: readPositiveInteger(readSingleParam(rawSearchParams, "periodo")),
    status: readLatenessStatus(readSingleParam(rawSearchParams, "estado")),
    classification: readLatenessClassification(readSingleParam(rawSearchParams, "tipo")),
    search: readSingleParam(rawSearchParams, "q").trim(),
    page: readPositiveInteger(readSingleParam(rawSearchParams, "pagina")) ?? 1,
  };

  const [result, settingsLogResult] = await Promise.all([getLatenessPage(filters), getLatenessSettingsLog()]);

  // Filtros vigentes de la URL (sin `pagina`) para que la paginación los conserve.
  const currentSearchParams: Record<string, string> = {};
  if (filters.idPeriod !== null) currentSearchParams.periodo = String(filters.idPeriod);
  if (filters.status !== "all") currentSearchParams.estado = LATENESS_STATUS_URL_VALUES[filters.status];
  if (filters.classification !== "all") {
    currentSearchParams.tipo = LATENESS_CLASSIFICATION_URL_VALUES[filters.classification];
  }
  if (filters.search) currentSearchParams.q = filters.search;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-1.5 text-sm text-[#44474f] dark:text-zinc-400">
          <span>Nómina</span>
          <ChevronRight size={14} />
          <span className="font-medium text-[#0b1c30] dark:text-zinc-100">Retardos</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-1 mb-1">
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">Retardos</h2>
          {result.ok && result.data.period && <PayrollStatusBadge status={result.data.period.status} />}
        </div>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Llegadas tarde de los podólogos, medidas contra la entrada de su horario con su primera checada del día.
        </p>
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-[#0051d5]/20 bg-[#0051d5]/5 dark:border-blue-800 dark:bg-blue-900/20 px-4 py-3 text-sm text-[#00174b] dark:text-blue-200">
        <Info size={18} className="shrink-0 mt-0.5 text-[#0051d5] dark:text-blue-300" aria-hidden />
        Los retardos injustificados se descuentan del sueldo base al calcular la nómina del periodo. Revisa esta lista
        antes de calcular: un checador con el reloj desfasado genera retardos falsos.
      </p>

      {result.ok && (
        <section aria-label="Reglas de retardos" className="flex flex-col gap-3">
          <LatenessSettingsCard
            settings={result.data.settings}
            frequencyOptions={result.data.frequencyOptions}
            editAction={
              <EditLatenessSettingsButton
                settings={result.data.settings}
                frequencyOptions={result.data.frequencyOptions}
              />
            }
          />
          {settingsLogResult.ok && (
            <LatenessSettingsLog entries={settingsLogResult.data} frequencyOptions={result.data.frequencyOptions} />
          )}
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
            description="Crea un periodo para revisar los retardos de sus empleados."
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
              <Link href="/dashboard/nomina/retardos" className={PAYROLL_LINK_BUTTON_CLASSES}>
                Ver el periodo actual
              </Link>
            }
          />
        )
      ) : (
        <>
          <LatenessToolbar
            periodOptions={result.data.periodOptions}
            selectedPeriodId={result.data.period.id_period}
            selectedStatus={filters.status}
            selectedClassification={filters.classification}
            searchText={filters.search}
          />
          {result.data.settings === null ? (
            <LatenessWarning
              title="Sin configuración de retardos"
              description="Mientras la empresa no tenga tolerancia y escalones definidos no se detecta ni se descuenta ningún retardo."
            />
          ) : (
            <>
              {!result.data.periodHasTiers && (
                <LatenessWarning
                  title={`Sin escalones para ${result.data.period.frecuencia_descripcion}`}
                  description="Los retardos acumulables no se descuentan en esta frecuencia; solo descuentan los graves."
                />
              )}
              <LatenessSummaryCards summary={result.data.summary} />
              <PayrollRecalculationNotice
                recalculationNeeded={result.data.recalculationNeeded}
                message="Hay retardos que no coinciden con el último cálculo. Recalcula la nómina."
              />
              <EmployeesWithoutScheduleNotice
                employees={result.data.employeesWithoutSchedule}
                undetectableSubject="sus retardos"
              />
              <LatenessEmployeeSummaryTable employeeSummaries={result.data.employeeSummaries} />
              <LatenessDaysTable
                rows={result.data.rows}
                totalRows={result.data.totalRows}
                page={filters.page}
                hasActiveFilters={
                  filters.status !== "all" || filters.classification !== "all" || filters.search !== ""
                }
                currentSearchParams={currentSearchParams}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
