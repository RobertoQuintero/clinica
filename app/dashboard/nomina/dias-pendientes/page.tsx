import Link from "next/link";
import { ChevronRight, Info } from "lucide-react";
import { readPositiveInteger, readSingleParam, type SearchParamsInput } from "@/lib/payroll/processUrls";
import PayrollEmptyState, { PAYROLL_LINK_BUTTON_CLASSES } from "../componentes/PayrollEmptyState";
import PayrollPeriodFilterToolbar from "../componentes/PayrollPeriodFilterToolbar";
import PayrollRecalculationNotice from "../componentes/PayrollRecalculationNotice";
import PendingDaysNotCoveredNotice from "../componentes/PendingDaysNotCoveredNotice";
import { PayrollStatusBadge } from "../periodos/componentes/PayrollBadges";
import { getPendingDaysPage } from "./actions";
import CapturePendingDaysButton from "./componentes/PendingDayPaymentModal";
import PendingDaysSummaryCards from "./componentes/PendingDaysSummaryCards";
import PendingDayPaymentsTable from "./componentes/PendingDayPaymentsTable";

export default async function PendingDaysPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const rawSearchParams = await searchParams;

  const filters = {
    idPeriod: readPositiveInteger(readSingleParam(rawSearchParams, "periodo")),
    search: readSingleParam(rawSearchParams, "q").trim(),
    page: readPositiveInteger(readSingleParam(rawSearchParams, "pagina")) ?? 1,
  };

  const result = await getPendingDaysPage(filters);

  // Filtros vigentes de la URL (sin `pagina`) para que la paginación los conserve.
  const currentSearchParams: Record<string, string> = {};
  if (filters.idPeriod !== null) currentSearchParams.periodo = String(filters.idPeriod);
  if (filters.search) currentSearchParams.q = filters.search;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-1.5 text-sm text-[#44474f] dark:text-zinc-400">
          <span>Nómina</span>
          <ChevronRight size={14} />
          <span className="font-medium text-[#0b1c30] dark:text-zinc-100">Días pendientes</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-1 mb-1">
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">Días pendientes de pago</h2>
          {result.ok && result.data.period && <PayrollStatusBadge status={result.data.period.status} />}
        </div>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Captura a mano los días ya trabajados que no se le pagaron a un empleado, para pagarlos en este periodo.
        </p>
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-[#0051d5]/20 bg-[#0051d5]/5 dark:border-blue-800 dark:bg-blue-900/20 px-4 py-3 text-sm text-[#00174b] dark:text-blue-200">
        <Info size={18} className="shrink-0 mt-0.5 text-[#0051d5] dark:text-blue-300" aria-hidden />
        Cada captura se paga una sola vez, en la nómina operativa y en la fiscal, cada una a su propia tarifa diaria.
        Corregir algo ya pagado es Reabrir el periodo o capturarlo en el siguiente.
      </p>

      {!result.ok ? (
        <p role="alert" className="rounded-xl border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 px-4 py-3 text-sm text-[#ba1a1a] dark:text-red-400">
          {result.message}
        </p>
      ) : !result.data.period ? (
        result.data.periodOptions.length === 0 ? (
          <PayrollEmptyState
            title="Esta sucursal aún no tiene periodos ordinarios de nómina"
            description="Crea un periodo para capturar sus días pendientes de pago."
            action={
              <Link href="/dashboard/nomina/periodos" className={PAYROLL_LINK_BUTTON_CLASSES}>
                Ir a Periodos de Nómina
              </Link>
            }
          />
        ) : (
          <PayrollEmptyState
            title="No encontramos ese periodo en esta sucursal"
            description="Puede pertenecer a otra sucursal, ser extraordinario o haberse eliminado."
            action={
              <Link href="/dashboard/nomina/dias-pendientes" className={PAYROLL_LINK_BUTTON_CLASSES}>
                Ver el periodo actual
              </Link>
            }
          />
        )
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1">
              <PayrollPeriodFilterToolbar
                periodOptions={result.data.periodOptions}
                selectedPeriodId={result.data.period.id_period}
                searchText={filters.search}
              />
            </div>
            {result.data.canCapture && (
              <CapturePendingDaysButton
                idPeriod={result.data.period.id_period}
                periodFechaFin={result.data.period.fecha_fin}
                periodOptions={result.data.periodOptions}
                activeEmployees={result.data.activeEmployees}
              />
            )}
          </div>

          <PayrollRecalculationNotice
            recalculationNeeded={result.data.recalculationNeeded}
            message="Hay días pendientes de pago que no coinciden con el último cálculo. Recalcula la nómina."
          />
          <PendingDaysNotCoveredNotice notCovered={result.data.notCovered} />

          <PendingDaysSummaryCards summary={result.data.summary} />

          <PendingDayPaymentsTable
            rows={result.data.rows}
            totalRows={result.data.totalRows}
            page={filters.page}
            hasActiveFilters={filters.search !== ""}
            canCapture={result.data.canCapture}
            currentSearchParams={currentSearchParams}
          />
        </>
      )}
    </div>
  );
}
