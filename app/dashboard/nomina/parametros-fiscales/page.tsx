import { ChevronRight } from "lucide-react";
import { addZeroToday } from "@/utils/date_helpper";
import { readPositiveInteger, readSingleParam, type SearchParamsInput } from "@/lib/payroll/processUrls";
import { buildYearOptions, readTaxParametersTab } from "@/lib/payroll/taxParametersUrls";
import {
  getPerceptions,
  getTaxParametersLog,
  getTaxParametersPage,
  getWithholdingTable,
} from "./actions";
import CopyWithholdingTableButton from "./componentes/CopyWithholdingTableButton";
import PerceptionsTable from "./componentes/PerceptionsTable";
import { NewTaxParameterButton } from "./componentes/TaxParameterModal";
import TaxParametersLog from "./componentes/TaxParametersLog";
import TaxParametersTable from "./componentes/TaxParametersTable";
import TaxParametersTabs from "./componentes/TaxParametersTabs";
import TaxYearSelector from "./componentes/TaxYearSelector";
import { NewWithholdingBracketButton } from "./componentes/WithholdingBracketModal";
import WithholdingBracketsTable from "./componentes/WithholdingBracketsTable";

function ErrorAlert({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-xl border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 px-4 py-3 text-sm text-[#ba1a1a] dark:text-red-400">
      {message}
    </p>
  );
}

export default async function TaxParametersPage({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const rawSearchParams = await searchParams;
  const currentYear = Number(addZeroToday(new Date()).slice(0, 4));
  const selectedYear = readPositiveInteger(readSingleParam(rawSearchParams, "ejercicio")) ?? currentYear;
  const activeTab = readTaxParametersTab(readSingleParam(rawSearchParams, "pestana"));

  const [parametersResult, bracketsResult, perceptionsResult, logResult] = await Promise.all([
    activeTab === "parameters" ? getTaxParametersPage(selectedYear) : null,
    activeTab === "withholding" ? getWithholdingTable(selectedYear) : null,
    activeTab === "perceptions" ? getPerceptions() : null,
    getTaxParametersLog(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-[#44474f] dark:text-zinc-400">
            <span>Nómina</span>
            <ChevronRight size={14} />
            <span className="font-medium text-[#0b1c30] dark:text-zinc-100">Parámetros fiscales</span>
          </div>
          <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mt-1 mb-1">Parámetros fiscales</h2>
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            UMA, salario mínimo, subsidio, tarifa semanal del ISR y topes de exención que usa la nómina fiscal.
          </p>
        </div>
        <div className="flex items-end gap-3">
          {activeTab !== "perceptions" && (
            <TaxYearSelector
              selectedYear={selectedYear}
              yearOptions={buildYearOptions(currentYear, selectedYear)}
              activeTab={activeTab}
            />
          )}
          {activeTab === "parameters" && <NewTaxParameterButton year={selectedYear} />}
          {activeTab === "withholding" && bracketsResult?.ok && (
            <>
              <CopyWithholdingTableButton year={selectedYear} />
              <NewWithholdingBracketButton year={selectedYear} brackets={bracketsResult.data} />
            </>
          )}
        </div>
      </div>

      <TaxParametersTabs activeTab={activeTab} year={selectedYear} />

      {parametersResult &&
        (parametersResult.ok ? (
          <TaxParametersTable parameters={parametersResult.data} year={selectedYear} />
        ) : (
          <ErrorAlert message={parametersResult.message} />
        ))}

      {bracketsResult &&
        (bracketsResult.ok ? (
          <WithholdingBracketsTable brackets={bracketsResult.data} year={selectedYear} />
        ) : (
          <ErrorAlert message={bracketsResult.message} />
        ))}

      {perceptionsResult &&
        (perceptionsResult.ok ? (
          <PerceptionsTable perceptions={perceptionsResult.data} />
        ) : (
          <ErrorAlert message={perceptionsResult.message} />
        ))}

      {logResult.ok ? <TaxParametersLog entries={logResult.data} /> : <ErrorAlert message={logResult.message} />}
    </div>
  );
}
