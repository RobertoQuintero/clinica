import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { IPayrollEmployeeDetailFilters } from "@/interfaces/payroll_calculation";
import {
  buildPayrollProcessHref,
  readPayrollType,
  readPositiveInteger,
  readSingleParam,
  type SearchParamsInput,
} from "@/lib/payroll/processUrls";
import { getPayrollEmployeeDetail } from "../actions";
import PayrollEmployeeNavigation from "./componentes/PayrollEmployeeNavigation";
import PayrollEmployeeProfileCard from "./componentes/PayrollEmployeeProfileCard";
import PayrollTypeToggle from "./componentes/PayrollTypeToggle";
import PayrollPerceptionsCard from "./componentes/PayrollPerceptionsCard";

export default async function PayrollEmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id_empleado: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const [{ id_empleado: rawEmployeeId }, rawSearchParams] = await Promise.all([params, searchParams]);

  const idEmpleado = readPositiveInteger(rawEmployeeId);
  const idPeriod = readPositiveInteger(readSingleParam(rawSearchParams, "periodo"));
  if (idEmpleado === null || idPeriod === null) notFound();

  const filters: IPayrollEmployeeDetailFilters = {
    idEmpleado,
    idPeriod,
    payrollType: readPayrollType(readSingleParam(rawSearchParams, "tipo")),
    idPuesto: readPositiveInteger(readSingleParam(rawSearchParams, "puesto")),
    search: readSingleParam(rawSearchParams, "q").trim(),
  };

  const result = await getPayrollEmployeeDetail(filters);
  if (result.ok && result.data === null) notFound();

  const processHref = buildPayrollProcessHref(filters);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <nav aria-label="Ruta" className="flex items-center gap-1.5 text-sm text-[#44474f] dark:text-zinc-400">
            <span>Nómina</span>
            <ChevronRight size={14} aria-hidden />
            <Link href={processHref} className="hover:text-[#0051d5] dark:hover:text-blue-400 hover:underline">
              Procesar Nómina
            </Link>
            <ChevronRight size={14} aria-hidden />
            <span aria-current="page" className="font-medium text-[#0b1c30] dark:text-zinc-100">
              Detalle individual
            </span>
          </nav>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">Detalle de Nómina</h2>
            {result.ok && result.data && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono whitespace-nowrap border bg-[#dbe1ff] text-[#00174b] border-transparent dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700">
                {result.data.period.codigo}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={processHref}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#c4c6d0] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft size={16} aria-hidden />
            Regresar
          </Link>
          {result.ok && result.data && (
            <PayrollEmployeeNavigation
              previousEmployeeId={result.data.navigation.previousEmployeeId}
              nextEmployeeId={result.data.navigation.nextEmployeeId}
              filters={filters}
            />
          )}
        </div>
      </div>

      {result.ok && result.data && <PayrollTypeToggle idEmpleado={idEmpleado} filters={filters} />}

      {!result.ok ? (
        <p role="alert" className="rounded-xl border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 px-4 py-3 text-sm text-[#ba1a1a] dark:text-red-400">
          {result.message}
        </p>
      ) : (
        result.data && (
          <>
            <PayrollEmployeeProfileCard
              employee={result.data.employee}
              period={result.data.period}
              salarioDiario={result.data.snapshot?.salario_diario ?? null}
              payrollType={filters.payrollType}
            />
            {result.data.snapshot && (
              <div className="w-full max-w-3xl">
                <PayrollPerceptionsCard
                  perceptions={result.data.perceptions}
                  totalPerceptions={result.data.totalPerceptions}
                />
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
