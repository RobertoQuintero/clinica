import Link from "next/link";
import { CalendarX2, ChevronRight } from "lucide-react";
import type { IPayrollProcessFilters } from "@/interfaces/payroll_calculation";
import {
  readPayrollType,
  readPositiveInteger,
  readSingleParam,
  type SearchParamsInput,
} from "@/lib/payroll/processUrls";
import { addZeroToday } from "@/utils/date_helpper";
import { PayrollStatusBadge } from "../periodos/componentes/PayrollBadges";
import { getPayrollProcessPage } from "./actions";
import ExcludedEmployeesNotice from "./componentes/ExcludedEmployeesNotice";
import PayrollCalculationActions from "./componentes/PayrollCalculationActions";
import PayrollEmployeesTable from "./componentes/PayrollEmployeesTable";
import PayrollProcessSummaryCards from "./componentes/PayrollProcessSummaryCards";
import PayrollProcessToolbar from "./componentes/PayrollProcessToolbar";

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

export default async function ProcesarNominaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const rawSearchParams = await searchParams;
  const today = addZeroToday(new Date());

  const filters: IPayrollProcessFilters = {
    idPeriod: readPositiveInteger(readSingleParam(rawSearchParams, "periodo")),
    payrollType: readPayrollType(readSingleParam(rawSearchParams, "tipo")),
    idPuesto: readPositiveInteger(readSingleParam(rawSearchParams, "puesto")),
    search: readSingleParam(rawSearchParams, "q").trim(),
  };

  const result = await getPayrollProcessPage(filters);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-[#44474f] dark:text-zinc-400">
            <span>Nómina</span>
            <ChevronRight size={14} />
            <span className="font-medium text-[#0b1c30] dark:text-zinc-100">Procesar Nómina</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1 mb-1">
            <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">Procesar Nómina</h2>
            {result.ok && result.data.period && <PayrollStatusBadge status={result.data.period.status} />}
          </div>
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            Salario del periodo por empleado: salario diario por los días pagados.
          </p>
        </div>
        {/* En estatus 1 el botón "Calcular nómina" vive en el estado vacío. */}
        {result.ok && result.data.period && result.data.period.status !== 1 && (
          <PayrollCalculationActions
            idPeriod={result.data.period.id_period}
            periodCode={result.data.period.codigo}
            status={result.data.period.status}
          />
        )}
      </div>

      {!result.ok ? (
        <p role="alert" className="rounded-xl border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 px-4 py-3 text-sm text-[#ba1a1a] dark:text-red-400">
          {result.message}
        </p>
      ) : !result.data.period ? (
        result.data.periodOptions.length === 0 ? (
          <EmptyState
            title="Esta sucursal aún no tiene periodos de nómina"
            description="Crea un periodo para poder calcular el salario de sus empleados."
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
              <Link href="/dashboard/nomina/procesar" className={LINK_BUTTON_CLASSES}>
                Ver el periodo actual
              </Link>
            }
          />
        )
      ) : (
        <>
          <PayrollProcessToolbar
            periodOptions={result.data.periodOptions}
            selectedPeriodId={result.data.period.id_period}
            selectedPayrollType={filters.payrollType}
            puestoOptions={result.data.puestoOptions}
            selectedPuestoId={filters.idPuesto}
            searchText={filters.search}
          />
          <PayrollProcessSummaryCards
            period={result.data.period}
            payrollType={filters.payrollType}
            totals={result.data.totals}
            lastCalculatedAt={result.data.lastCalculatedAt}
            today={today}
          />
          <ExcludedEmployeesNotice
            excludedEmployees={result.data.excludedEmployees}
            payrollType={filters.payrollType}
          />
          {result.data.period.status === 1 ? (
            <EmptyState
              title="Este periodo aún no se calcula"
              description="Al calcular la nómina se guarda el salario de cada empleado del periodo, en su versión operativa y fiscal."
              action={
                <PayrollCalculationActions
                  idPeriod={result.data.period.id_period}
                  periodCode={result.data.period.codigo}
                  status={result.data.period.status}
                />
              }
            />
          ) : (
            <PayrollEmployeesTable
              rows={result.data.rows}
              payrollType={filters.payrollType}
              totals={result.data.totals}
              hasActiveFilters={filters.idPuesto !== null || filters.search !== ""}
            />
          )}
        </>
      )}
    </div>
  );
}
