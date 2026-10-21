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
import PayrollArticle174IsrCard from "./componentes/PayrollArticle174IsrCard";
import PayrollDeductionsCard from "./componentes/PayrollDeductionsCard";
import PayrollPaidTreatmentsList from "./componentes/PayrollPaidTreatmentsList";
import PayrollOvertimeDaysList from "./componentes/PayrollOvertimeDaysList";
import PayrollAbsencesList from "./componentes/PayrollAbsencesList";
import PayrollLatenessList from "./componentes/PayrollLatenessList";
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
  // Spec 87: el aguinaldo no tiene tratamientos, ventas, horas extra, faltas ni retardos que listar.
  const isExtraordinary = detail?.period.tipo_periodo === "E";
  // Spec 90: la PTU solo existe en la nómina fiscal, así que no hay toggle y se ignora `tipo=operativa` de la URL.
  const isPtuPeriod = isExtraordinary && detail?.period.concepto_extraordinario === "P";
  const payrollType = isPtuPeriod ? "F" : filters.payrollType;
  const viewFilters: IPayrollEmployeeDetailFilters = { ...filters, payrollType };
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
              filters={viewFilters}
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
          {!isPtuPeriod && <PayrollTypeToggle idEmpleado={idEmpleado} filters={filters} />}
          <PayrollEmployeeProfileCard
            employee={detail.employee}
            period={detail.period}
            salarioDiario={detail.snapshot?.salario_diario ?? null}
            payrollType={payrollType}
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
            <div className="w-full max-w-6xl flex flex-col gap-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                <PayrollPerceptionsCard
                  perceptions={detail.perceptions}
                  totalPerceptions={detail.totalPerceptions}
                  showTaxBreakdown={payrollType === "F"}
                  totalTaxed={detail.totalTaxed}
                  totalExempt={detail.totalExempt}
                />
                {payrollType === "F" &&
                  (isExtraordinary ? (
                    <PayrollArticle174IsrCard
                      breakdown={detail.article174}
                      totalPerceptions={detail.totalPerceptions}
                      totalDeductions={detail.totalDeductions}
                      fiscalYear={Number(detail.period.fecha_fin.slice(0, 4))}
                      concept={detail.period.concepto_extraordinario ?? "A"}
                    />
                  ) : (
                    <PayrollDeductionsCard
                      isrBreakdown={detail.snapshot}
                      imssSnapshot={detail.snapshot}
                      contributionRegime={detail.employee.tipo_regimen}
                      employeeId={detail.employee.id_empleado}
                      fiscalYear={Number(detail.period.fecha_fin.slice(0, 4))}
                      totalPerceptions={detail.totalPerceptions}
                      totalDeductions={detail.totalDeductions}
                    />
                  ))}
              </div>
              {!isExtraordinary && (
                <>
                  <PayrollPaidTreatmentsList paidTreatments={detail.paidTreatments} />
                  <PayrollSoldProductsList soldProducts={detail.soldProducts} />
                  <PayrollOvertimeDaysList overtimeDays={detail.overtimeDays} />
                  <PayrollAbsencesList discountedAbsences={detail.discountedAbsences} />
                  <PayrollLatenessList discountedLateness={detail.discountedLateness} />
                </>
              )}
            </div>
          ) : (
            <PayrollDetailNotice
              title={`Este empleado no está en la nómina ${PAYROLL_TYPE[payrollType].label.toLowerCase()} de este periodo`}
              description={
                isPtuPeriod
                  ? "La PTU incluye a los trabajadores de la sucursal con PTU mayor que cero en el reparto cerrado."
                  : isExtraordinary
                  ? `El aguinaldo incluye a los empleados activos de la sucursal con salario diario ${PAYROLL_TYPE[payrollType].label.toLowerCase()} capturado.`
                  : `Al calcular se incluyen los empleados activos de la frecuencia del periodo con salario diario ${PAYROLL_TYPE[payrollType].label.toLowerCase()} capturado.`
              }
            />
          )}
        </>
      )}
    </div>
  );
}
