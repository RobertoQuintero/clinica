import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { IPayrollEmployeeDetailFilters } from "@/interfaces/payroll_calculation";
import { PAYROLL_TYPE } from "@/lib/payroll/constants";
import {
  buildPayrollProcessHref,
  readPayrollType,
  readPositiveInteger,
  readSingleParam,
  type SearchParamsInput,
} from "@/lib/payroll/processUrls";
import { getPayrollEmployeeDetail } from "../actions";
import PayrollDetailNotice from "./componentes/PayrollDetailNotice";
import PayrollEmployeeNavigation from "./componentes/PayrollEmployeeNavigation";
import PayrollEmployeeProfileCard from "./componentes/PayrollEmployeeProfileCard";
import PayrollTypeToggle from "./componentes/PayrollTypeToggle";
import PayrollPerceptionsCard from "./componentes/PayrollPerceptionsCard";
import PayrollPaidTreatmentsList from "./componentes/PayrollPaidTreatmentsList";
import PayrollOvertimeDaysList from "./componentes/PayrollOvertimeDaysList";
import PayrollSoldProductsList from "./componentes/PayrollSoldProductsList";

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
  const detail = result.ok ? result.data : null;
  const isPeriodCalculated = detail !== null && detail.period.status !== 1;
  // Sin cálculo (estatus 1) o sin fila en el tipo seleccionado no hay Anterior / Siguiente.
  const showNavigation = isPeriodCalculated && detail.snapshot !== null;

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
            {detail && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono whitespace-nowrap border bg-[#dbe1ff] text-[#00174b] border-transparent dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700">
                {detail.period.codigo}
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
          {detail && showNavigation && (
            <PayrollEmployeeNavigation
              previousEmployeeId={detail.navigation.previousEmployeeId}
              nextEmployeeId={detail.navigation.nextEmployeeId}
              filters={filters}
            />
          )}
        </div>
      </div>

      {!result.ok && (
        <p role="alert" className="rounded-xl border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 px-4 py-3 text-sm text-[#ba1a1a] dark:text-red-400">
          {result.message}
        </p>
      )}

      {detail && (
        <>
          <PayrollTypeToggle idEmpleado={idEmpleado} filters={filters} />
          <PayrollEmployeeProfileCard
            employee={detail.employee}
            period={detail.period}
            salarioDiario={detail.snapshot?.salario_diario ?? null}
            payrollType={filters.payrollType}
          />
          {!isPeriodCalculated ? (
            <PayrollDetailNotice
              title="Esta nómina aún no se calcula"
              description="Cuando se calcule el periodo, aquí verás las percepciones del empleado."
              action={
                <Link
                  href={processHref}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003ea7] transition-colors"
                >
                  Ir a Procesar Nómina
                </Link>
              }
            />
          ) : detail.snapshot ? (
            <div className="w-full max-w-3xl flex flex-col gap-5">
              <PayrollPerceptionsCard
                perceptions={detail.perceptions}
                totalPerceptions={detail.totalPerceptions}
              />
              <PayrollPaidTreatmentsList paidTreatments={detail.paidTreatments} />
              <PayrollSoldProductsList soldProducts={detail.soldProducts} />
              <PayrollOvertimeDaysList overtimeDays={detail.overtimeDays} />
            </div>
          ) : (
            <PayrollDetailNotice
              title={`Este empleado no está en la nómina ${PAYROLL_TYPE[filters.payrollType].label.toLowerCase()} de este periodo`}
              description={`Al calcular se incluyen los empleados activos de la frecuencia del periodo con salario diario ${PAYROLL_TYPE[filters.payrollType].label.toLowerCase()} capturado.`}
            />
          )}
        </>
      )}
    </div>
  );
}
