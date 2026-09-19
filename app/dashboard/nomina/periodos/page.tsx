import { ChevronRight } from "lucide-react";
import type { IPayrollPeriodFilters, PayrollPeriodStatus } from "@/interfaces/payroll_period";
import { addZeroToday } from "@/utils/date_helpper";
import { getPayrollFrequencies, getPayrollPeriodsPage } from "./actions";
import ActivePayrollPeriodCard from "./componentes/ActivePayrollPeriodCard";
import { NewPayrollPeriodButton } from "./componentes/PayrollPeriodActions";
import PayrollPeriodsFilterBar from "./componentes/PayrollPeriodsFilterBar";
import PayrollPeriodsTable from "./componentes/PayrollPeriodsTable";

type SearchParamsInput = Record<string, string | string[] | undefined>;

function readSingleParam(searchParams: SearchParamsInput, key: string): string {
  const value = searchParams[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function readPositiveInteger(rawValue: string): number | null {
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default async function PeriodosNominaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const rawSearchParams = await searchParams;
  const today = addZeroToday(new Date());

  const status = readPositiveInteger(readSingleParam(rawSearchParams, "estatus"));
  const filters: IPayrollPeriodFilters = {
    idPaymentPeriod: readPositiveInteger(readSingleParam(rawSearchParams, "frecuencia")),
    status: status !== null && status <= 4 ? (status as PayrollPeriodStatus) : null,
    ejercicio: readPositiveInteger(readSingleParam(rawSearchParams, "ejercicio")) ?? Number(today.slice(0, 4)),
    search: readSingleParam(rawSearchParams, "q").trim(),
    page: readPositiveInteger(readSingleParam(rawSearchParams, "pagina")) ?? 1,
  };

  const [result, frequenciesResult] = await Promise.all([
    getPayrollPeriodsPage(filters),
    getPayrollFrequencies(),
  ]);

  const currentSearchParams: Record<string, string> = {};
  for (const key of ["frecuencia", "estatus", "ejercicio", "q"]) {
    const value = readSingleParam(rawSearchParams, key);
    if (value) currentSearchParams[key] = value;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-[#44474f] dark:text-zinc-400">
            <span>Nómina</span>
            <ChevronRight size={14} />
            <span className="font-medium text-[#0b1c30] dark:text-zinc-100">Periodos de Nómina</span>
          </div>
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mt-1 mb-1">Periodos de Nómina</h2>
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            Calendario de corte y pago de la sucursal seleccionada.
          </p>
        </div>
        {frequenciesResult.ok && <NewPayrollPeriodButton frequencies={frequenciesResult.data} />}
      </div>

      {!result.ok ? (
        <p role="alert" className="rounded-xl border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 px-4 py-3 text-sm text-[#ba1a1a] dark:text-red-400">
          {result.message}
        </p>
      ) : (
        <>
          <ActivePayrollPeriodCard activePeriod={result.data.activePeriod} today={today} />
          <PayrollPeriodsFilterBar
            frequencyCounts={result.data.frequencyCounts}
            availableYears={result.data.availableYears}
            selectedFrequencyId={filters.idPaymentPeriod}
            selectedStatus={filters.status}
            selectedYear={filters.ejercicio}
            searchText={filters.search}
          />
          <PayrollPeriodsTable
            rows={result.data.rows}
            totalRows={result.data.totalRows}
            page={filters.page}
            ejercicio={filters.ejercicio}
            currentSearchParams={currentSearchParams}
          />
        </>
      )}
    </div>
  );
}
