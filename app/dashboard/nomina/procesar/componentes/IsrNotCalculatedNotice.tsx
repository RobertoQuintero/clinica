import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { IPayrollProcessPage } from "@/interfaces/payroll_calculation";
import type { Article174SkipReason } from "@/interfaces/payroll_christmas_bonus";
import type { IsrSkipReason } from "@/interfaces/payroll_isr";
import { describeArticle174SkipReason } from "@/lib/payroll/isrArticle174";
import { describeIsrSkipReason } from "@/lib/payroll/isrCalculation";
import {
  buildTaxParametersHref,
  type TaxParametersTab,
  type WithholdingFrequency,
} from "@/lib/payroll/taxParametersUrls";

interface Props {
  isrNotCalculated: IPayrollProcessPage["isrNotCalculated"];
  /** Año de `fecha_fin`: el ejercicio de la tarifa que se buscó. */
  fiscalYear: number;
  /** Spec 87: en un periodo extraordinario los motivos son los del ISR art. 174 y la tarifa es la mensual. */
  isExtraordinary?: boolean;
}

type SkipReason = IsrSkipReason | Article174SkipReason;

// Pestaña de Parámetros fiscales donde se corrige cada motivo.
const TAX_PARAMETERS_TAB_BY_REASON: Record<SkipReason, TaxParametersTab> = {
  no_withholding_table: "withholding",
  income_in_gap: "withholding",
  missing_subsidy_parameters: "parameters",
  exemption_not_calculated: "parameters",
  no_monthly_withholding_table: "withholding",
};

// Los motivos del art. 174 (aguinaldo) se corrigen en la tarifa mensual; el resto, en la semanal.
const MONTHLY_TARIFF_REASONS: ReadonlySet<SkipReason> = new Set<SkipReason>(["no_monthly_withholding_table"]);

function describeReason(reason: SkipReason, isExtraordinary: boolean): string {
  return isExtraordinary ? describeArticle174SkipReason(reason as Article174SkipReason) : describeIsrSkipReason(reason as IsrSkipReason);
}

const LINK_LABEL_BY_TAB: Record<TaxParametersTab, string> = {
  withholding: "Revisar la tarifa",
  parameters: "Revisar los parámetros",
  perceptions: "Revisar las percepciones",
};

function describeEmployees(count: number): string {
  return count === 1 ? "1 empleado" : `${count} empleados`;
}

/** Aviso de Procesar (vista fiscal) con los renglones que quedaron en "ISR no calculado" y por qué (spec 70). */
export default function IsrNotCalculatedNotice({ isrNotCalculated, fiscalYear, isExtraordinary = false }: Props) {
  if (isrNotCalculated.length === 0) return null;

  const totalEmployees = isrNotCalculated.reduce((sum, group) => sum + group.employees, 0);

  return (
    <section
      aria-label="Empleados sin ISR calculado"
      className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex gap-3"
    >
      <TriangleAlert size={20} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {totalEmployees === 1
            ? "1 empleado quedó sin ISR calculado"
            : `${totalEmployees} empleados quedaron sin ISR calculado`}
        </p>
        <p className="text-sm text-amber-800 dark:text-amber-300/90 mt-0.5">
          No se les retiene ISR hasta que captures lo que falta en Parámetros fiscales y recalcules la nómina.
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {isrNotCalculated.map((group) => {
            const tab = TAX_PARAMETERS_TAB_BY_REASON[group.reason];
            const frequency: WithholdingFrequency =
              isExtraordinary && (MONTHLY_TARIFF_REASONS.has(group.reason) || group.reason === "income_in_gap")
                ? "monthly"
                : "weekly";
            return (
              <li key={group.reason} className="flex flex-wrap items-baseline gap-x-2 text-sm text-amber-900 dark:text-amber-200">
                <span className="font-semibold tabular-nums">{describeEmployees(group.employees)}:</span>
                <span>{describeReason(group.reason, isExtraordinary)}.</span>
                <Link
                  href={buildTaxParametersHref(tab, fiscalYear, frequency)}
                  className="font-medium text-[#0051d5] dark:text-blue-300 underline-offset-2 hover:underline"
                >
                  {LINK_LABEL_BY_TAB[tab]}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
