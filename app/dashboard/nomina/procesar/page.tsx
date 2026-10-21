import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { IPayrollProcessFilters } from "@/interfaces/payroll_calculation";
import {
  readPayrollType,
  readPositiveInteger,
  readSingleParam,
  type SearchParamsInput,
} from "@/lib/payroll/processUrls";
import { addZeroToday } from "@/utils/date_helpper";
import ManualHelpLink from "@/app/dashboard/componentes/ManualHelpLink";
import { PAYROLL_MANUAL_TOPICS } from "@/lib/manual/links";
import { PayrollStatusBadge } from "../periodos/componentes/PayrollBadges";
import { getPayrollProcessPage } from "./actions";
import ChristmasBonusDeadlineNotice from "../componentes/ChristmasBonusDeadlineNotice";
import PtuPaymentDeadlineNotice from "../componentes/PtuPaymentDeadlineNotice";
import PayrollRecalculationNotice from "../componentes/PayrollRecalculationNotice";
import ChristmasBonusEmployeesTable from "./componentes/ChristmasBonusEmployeesTable";
import ExcludedEmployeesNotice from "./componentes/ExcludedEmployeesNotice";
import PtuPaymentEmployeesTable from "./componentes/PtuPaymentEmployeesTable";
import ImssNotCalculatedNotice from "./componentes/ImssNotCalculatedNotice";
import IsrNotCalculatedNotice from "./componentes/IsrNotCalculatedNotice";
import PayrollCalculationActions from "./componentes/PayrollCalculationActions";
import PayrollEmployeesTable from "./componentes/PayrollEmployeesTable";
import PayrollProcessSummaryCards from "./componentes/PayrollProcessSummaryCards";
import PayrollProcessToolbar from "./componentes/PayrollProcessToolbar";
import PayrollEmptyState, { PAYROLL_LINK_BUTTON_CLASSES } from "../componentes/PayrollEmptyState";

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
  // Spec 87/90: un periodo extraordinario (aguinaldo o PTU) tiene sus propias columnas y no usa los avisos de incidencias.
  const isExtraordinary = result.ok && result.data.period?.tipo_periodo === "E";
  const isPtuPeriod = isExtraordinary && result.ok && result.data.period?.concepto_extraordinario === "P";
  // La PTU solo existe en la nómina fiscal: se ignora `tipo=operativa` de la URL.
  const payrollType = isPtuPeriod ? "F" : filters.payrollType;

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
            <ManualHelpLink moduleSlug="nomina" topicSlug={PAYROLL_MANUAL_TOPICS.processPayroll} />
            {result.ok && result.data.period && <PayrollStatusBadge status={result.data.period.status} />}
          </div>
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            {isPtuPeriod
              ? "PTU del reparto cerrado por empleado: lo que se paga, lo gravado y el ISR del art. 174."
              : isExtraordinary
                ? "Aguinaldo anual por empleado: 15 días de salario diario, proporcional a los días del año."
                : "Salario del periodo por empleado: salario diario por los días pagados."}
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

      <ChristmasBonusDeadlineNotice />
      <PtuPaymentDeadlineNotice />

      {!result.ok ? (
        <p role="alert" className="rounded-xl border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 px-4 py-3 text-sm text-[#ba1a1a] dark:text-red-400">
          {result.message}
        </p>
      ) : !result.data.period ? (
        result.data.periodOptions.length === 0 ? (
          <PayrollEmptyState
            title="Esta sucursal aún no tiene periodos de nómina"
            description="Crea un periodo para poder calcular el salario de sus empleados."
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
              <Link href="/dashboard/nomina/procesar" className={PAYROLL_LINK_BUTTON_CLASSES}>
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
            selectedPayrollType={payrollType}
            showPayrollTypeToggle={!isPtuPeriod}
            puestoOptions={result.data.puestoOptions}
            selectedPuestoId={filters.idPuesto}
            searchText={filters.search}
          />
          <PayrollProcessSummaryCards
            period={result.data.period}
            payrollType={payrollType}
            totals={result.data.totals}
            lastCalculatedAt={result.data.lastCalculatedAt}
            today={today}
            isrNotCalculatedEmployees={result.data.isrNotCalculated.reduce((sum, group) => sum + group.employees, 0)}
            imssNotCalculatedEmployees={result.data.imssNotCalculated.reduce((sum, group) => sum + group.employees, 0)}
          />
          <ExcludedEmployeesNotice
            excludedEmployees={result.data.excludedEmployees}
            payrollType={payrollType}
          />
          {payrollType === "F" && (
            <IsrNotCalculatedNotice
              isrNotCalculated={result.data.isrNotCalculated}
              fiscalYear={Number(result.data.period.fecha_fin.slice(0, 4))}
              isExtraordinary={isExtraordinary}
            />
          )}
          {payrollType === "F" && !isExtraordinary && (
            <ImssNotCalculatedNotice
              imssNotCalculated={result.data.imssNotCalculated}
              fiscalYear={Number(result.data.period.fecha_fin.slice(0, 4))}
            />
          )}
          <PayrollRecalculationNotice
            recalculationNeeded={result.data.overtimeRecalculationNeeded}
            message="Hay autorizaciones que no coinciden con el último cálculo. Recalcula la nómina."
          />
          <PayrollRecalculationNotice
            recalculationNeeded={result.data.absenceRecalculationNeeded}
            message="Hay faltas que no coinciden con el último cálculo. Recalcula la nómina."
          />
          <PayrollRecalculationNotice
            recalculationNeeded={result.data.latenessRecalculationNeeded}
            message="Hay retardos que no coinciden con el último cálculo. Recalcula la nómina."
          />
          <PayrollRecalculationNotice
            recalculationNeeded={result.data.punctualityBonusRecalculationNeeded}
            message="Hay bonos de puntualidad que no coinciden con el último cálculo. Recalcula la nómina."
          />
          <PayrollRecalculationNotice
            recalculationNeeded={result.data.attendanceBonusRecalculationNeeded}
            message="Hay bonos de asistencia que no coinciden con el último cálculo. Recalcula la nómina."
          />
          <PayrollRecalculationNotice
            recalculationNeeded={result.data.shiftExtensionBonusRecalculationNeeded}
            message="Hay bonos por extensión de jornada que no coinciden con el último cálculo. Recalcula la nómina."
          />
          <PayrollRecalculationNotice
            recalculationNeeded={result.data.isrRecalculationNeeded}
            message="Hay cálculos de ISR que no coinciden con la tarifa o los parámetros actuales. Recalcula la nómina."
          />
          <PayrollRecalculationNotice
            recalculationNeeded={result.data.imssRecalculationNeeded}
            message="Hay cálculos de IMSS que no coinciden con el SBC, las tasas o los parámetros actuales. Recalcula la nómina."
          />
          <PayrollRecalculationNotice
            recalculationNeeded={result.data.exemptionRecalculationNeeded}
            message="Hay percepciones cuyo exento no coincide con el catálogo, la UMA o lo exentado en periodos anteriores. Recalcula la nómina."
          />
          <PayrollRecalculationNotice
            recalculationNeeded={result.data.vacationPayRecalculationNeeded}
            message="Hay vacaciones o primas que no coinciden con el último cálculo. Recalcula la nómina."
          />
          <PayrollRecalculationNotice
            recalculationNeeded={result.data.extraordinaryRecalculationNeeded}
            message={
              isPtuPeriod
                ? "Hay cálculos de ISR del art. 174 de la PTU que no coinciden con la tarifa mensual actual. Recalcula la nómina."
                : "Hay aguinaldos cuyo salario, fecha de ingreso o ISR del art. 174 no coinciden con el último cálculo. Recalcula la nómina."
            }
          />
          {result.data.period.status === 1 ? (
            <PayrollEmptyState
              title="Este periodo aún no se calcula"
              description={
                isPtuPeriod
                  ? "Al calcular se guarda la PTU de cada trabajador de la sucursal en el reparto cerrado, solo en su versión fiscal."
                  : isExtraordinary
                  ? "Al calcular se guarda el aguinaldo de cada empleado activo de la sucursal, en su versión operativa y fiscal."
                  : "Al calcular la nómina se guarda el salario de cada empleado del periodo, en su versión operativa y fiscal."
              }
              action={
                <PayrollCalculationActions
                  idPeriod={result.data.period.id_period}
                  periodCode={result.data.period.codigo}
                  status={result.data.period.status}
                />
              }
            />
          ) : isPtuPeriod ? (
            <PtuPaymentEmployeesTable
              rows={result.data.rows}
              idPeriod={result.data.period.id_period}
              idPuesto={filters.idPuesto}
              search={filters.search}
              totals={result.data.totals}
              hasActiveFilters={filters.idPuesto !== null || filters.search !== ""}
            />
          ) : isExtraordinary ? (
            <ChristmasBonusEmployeesTable
              rows={result.data.rows}
              idPeriod={result.data.period.id_period}
              payrollType={payrollType}
              idPuesto={filters.idPuesto}
              search={filters.search}
              totals={result.data.totals}
              hasActiveFilters={filters.idPuesto !== null || filters.search !== ""}
            />
          ) : (
            <PayrollEmployeesTable
              rows={result.data.rows}
              idPeriod={result.data.period.id_period}
              payrollType={payrollType}
              idPuesto={filters.idPuesto}
              search={filters.search}
              totals={result.data.totals}
              hasActiveFilters={filters.idPuesto !== null || filters.search !== ""}
            />
          )}
        </>
      )}
    </div>
  );
}
