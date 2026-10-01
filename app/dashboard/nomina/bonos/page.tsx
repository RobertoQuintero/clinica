import Link from "next/link";
import { ChevronRight, Info, TriangleAlert } from "lucide-react";
import type { IPunctualityBonusFilters } from "@/interfaces/payroll_punctuality_bonus";
import { readPositiveInteger, readSingleParam, type SearchParamsInput } from "@/lib/payroll/processUrls";
import {
  BONUS_RESULT_URL_VALUES,
  readBonusResult,
} from "@/lib/payroll/bonusUrls";
import EmployeesWithoutScheduleNotice from "../componentes/EmployeesWithoutScheduleNotice";
import PayrollEmptyState, { PAYROLL_LINK_BUTTON_CLASSES } from "../componentes/PayrollEmptyState";
import PayrollRecalculationNotice from "../componentes/PayrollRecalculationNotice";
import { PayrollStatusBadge } from "../periodos/componentes/PayrollBadges";
import { getPunctualityBonusPage, getPunctualityBonusSettingsLog } from "./actions";
import PunctualityBonusEmployeesTable from "./componentes/PunctualityBonusEmployeesTable";
import BonusSettingsCard from "./componentes/BonusSettingsCard";
import BonusSettingsLog from "./componentes/BonusSettingsLog";
import { EditBonusSettingsButton } from "./componentes/BonusSettingsModal";
import PunctualityBonusSummaryCards from "./componentes/PunctualityBonusSummaryCards";
import BonusResultToolbar from "./componentes/BonusResultToolbar";

const NOTICE_CLASSES =
  "rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex gap-3";

function PunctualityBonusWarning({ title, description }: { title: string; description: string }) {
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

export default async function PunctualityBonusPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const rawSearchParams = await searchParams;

  const filters: IPunctualityBonusFilters = {
    idPeriod: readPositiveInteger(readSingleParam(rawSearchParams, "periodo")),
    result: readBonusResult(readSingleParam(rawSearchParams, "resultado")),
    search: readSingleParam(rawSearchParams, "q").trim(),
    page: readPositiveInteger(readSingleParam(rawSearchParams, "pagina")) ?? 1,
  };

  const [result, settingsLogResult] = await Promise.all([
    getPunctualityBonusPage(filters),
    getPunctualityBonusSettingsLog(),
  ]);

  // Filtros vigentes de la URL (sin `pagina`) para que la paginación los conserve.
  const currentSearchParams: Record<string, string> = {};
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
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">Bonos de puntualidad</h2>
          {result.ok && result.data.period && <PayrollStatusBadge status={result.data.period.status} />}
        </div>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Los podólogos que estuvieron el periodo completo cobran el bono si sus retardos y faltas injustificados no
          pasan del máximo.
        </p>
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-[#0051d5]/20 bg-[#0051d5]/5 dark:border-blue-800 dark:bg-blue-900/20 px-4 py-3 text-sm text-[#00174b] dark:text-blue-200">
        <Info size={18} className="shrink-0 mt-0.5 text-[#0051d5] dark:text-blue-300" aria-hidden />
        Los retardos y las faltas se justifican en sus propias pantallas. Revisa Retardos, Faltas y esta lista antes de
        calcular, y recalcula después de que termine el periodo: las faltas solo cuentan hasta ayer.
      </p>

      {result.ok && (
        <section aria-label="Reglas del bono de puntualidad" className="flex flex-col gap-3">
          <BonusSettingsCard
            bonusKind="punctuality"
            settings={result.data.settings}
            editAction={<EditBonusSettingsButton bonusKind="punctuality" settings={result.data.settings} />}
          />
          {settingsLogResult.ok && <BonusSettingsLog bonusKind="punctuality" entries={settingsLogResult.data} />}
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
            description="Crea un periodo para revisar el bono de puntualidad de sus podólogos."
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
              <Link href="/dashboard/nomina/bonos" className={PAYROLL_LINK_BUTTON_CLASSES}>
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
          {!result.data.hasLatenessSettings && (
            <PunctualityBonusWarning
              title="Sin configuración de retardos"
              description="Sin tolerancia no se pueden detectar retardos, así que nadie se evalúa para el bono. Configúrala en Retardos."
            />
          )}
          {!isBonusActiveForPeriod && (
            <PunctualityBonusWarning
              title={`Bono no configurado para ${periodSetting?.frequencyName ?? "esta frecuencia"}`}
              description="Activa el bono de esta frecuencia en las reglas de arriba para que sus periodos lo paguen."
            />
          )}
          <PunctualityBonusSummaryCards summary={result.data.summary} />
          <PayrollRecalculationNotice
            recalculationNeeded={result.data.recalculationNeeded}
            message="Hay bonos de puntualidad que no coinciden con el último cálculo. Recalcula la nómina."
          />
          <EmployeesWithoutScheduleNotice
            employees={result.data.employeesWithoutSchedule}
            undetectableSubject="sus retardos y faltas"
          />
          <PunctualityBonusEmployeesTable
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
