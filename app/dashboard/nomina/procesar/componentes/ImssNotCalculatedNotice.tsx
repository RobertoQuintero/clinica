import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { IPayrollProcessPage } from "@/interfaces/payroll_calculation";
import type { ImssSkipReason } from "@/interfaces/payroll_imss";
import { describeImssSkipReason } from "@/lib/payroll/imssCalculation";
import { buildTaxParametersHref } from "@/lib/payroll/taxParametersUrls";

interface Props {
  imssNotCalculated: IPayrollProcessPage["imssNotCalculated"];
  /** Año de `fecha_fin`: el ejercicio de los parámetros que se buscaron. */
  fiscalYear: number;
}

// Estos motivos se corrigen en el expediente del empleado; el resto, en Parámetros fiscales.
const EMPLOYEE_REASONS: ReadonlySet<ImssSkipReason> = new Set<ImssSkipReason>(["missing_nss", "missing_sbc"]);

const MAX_LISTED_EMPLOYEES = 10;

function describeEmployees(count: number): string {
  return count === 1 ? "1 empleado" : `${count} empleados`;
}

/** Aviso de Procesar (vista fiscal ordinaria) con los renglones que quedaron en "IMSS no calculado" y por qué (spec 91). */
export default function ImssNotCalculatedNotice({ imssNotCalculated, fiscalYear }: Props) {
  if (imssNotCalculated.length === 0) return null;

  const totalEmployees = imssNotCalculated.reduce((sum, group) => sum + group.employees, 0);

  return (
    <section
      aria-label="Empleados sin IMSS calculado"
      className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex gap-3"
    >
      <TriangleAlert size={20} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {totalEmployees === 1
            ? "1 empleado quedó sin IMSS calculado"
            : `${totalEmployees} empleados quedaron sin IMSS calculado`}
        </p>
        <p className="text-sm text-amber-800 dark:text-amber-300/90 mt-0.5">
          No se les retiene IMSS hasta que captures lo que falta y recalcules la nómina.
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {imssNotCalculated.map((group) => (
            <li key={group.reason} className="flex flex-wrap items-baseline gap-x-2 text-sm text-amber-900 dark:text-amber-200">
              <span className="font-semibold tabular-nums">{describeEmployees(group.employees)}:</span>
              <span>{describeImssSkipReason(group.reason)}.</span>
              {EMPLOYEE_REASONS.has(group.reason) ? (
                <span className="flex flex-wrap gap-x-2">
                  {group.affected.slice(0, MAX_LISTED_EMPLOYEES).map((employee) => (
                    <Link
                      key={employee.id_empleado}
                      href={`/dashboard/empleados/${employee.id_empleado}/imss`}
                      className="font-medium text-[#0051d5] dark:text-blue-300 underline-offset-2 hover:underline"
                    >
                      {employee.nombre_completo}
                    </Link>
                  ))}
                  {group.affected.length > MAX_LISTED_EMPLOYEES && (
                    <span>y {group.affected.length - MAX_LISTED_EMPLOYEES} más</span>
                  )}
                </span>
              ) : (
                <Link
                  href={buildTaxParametersHref("parameters", fiscalYear)}
                  className="font-medium text-[#0051d5] dark:text-blue-300 underline-offset-2 hover:underline"
                >
                  Revisar los parámetros
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
