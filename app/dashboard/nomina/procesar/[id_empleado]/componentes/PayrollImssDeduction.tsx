import Link from "next/link";
import { Info, ShieldCheck, TriangleAlert } from "lucide-react";
import type { IImssBreakdown, ImssSkipReason, ImssStatus } from "@/interfaces/payroll_imss";
import { IMSS_CONTRIBUTION_REGIME } from "@/lib/payroll/constants";
import { describeImssSkipReason } from "@/lib/payroll/imssCalculation";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { formatPeriodDate } from "@/lib/payroll/periodFormat";
import { buildTaxParametersHref } from "@/lib/payroll/taxParametersUrls";
import { PayrollCalculationRow } from "./PayrollCalculationRow";

interface Props {
  imssStatus: ImssStatus;
  imssSkipReason: ImssSkipReason | null;
  imssWithheld: number | null;
  imssBreakdown: IImssBreakdown | null;
  /** `RH.empleados.tipo_regimen` actual: solo el 02 lleva IMSS. */
  contributionRegime: string | null;
  employeeId: number;
  fiscalYear: number;
}

const PLAIN_NUMBER_FORMATTER = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 4 });

function describeEffectiveDate(effectiveDate: string): string {
  return `vigente desde el ${formatPeriodDate(effectiveDate)}`;
}

interface IImssBranchLine {
  label: string;
  dailyBase: number;
  days: number;
  rate: number;
  amount: number;
}

function buildBranchLines(breakdown: IImssBreakdown): IImssBranchLine[] {
  return [
    { label: "Enf. y maternidad: excedente de 3 UMA", dailyBase: breakdown.excedente_diario, days: breakdown.dias_eym, rate: breakdown.tasa_eym_excedente, amount: breakdown.importe_eym_excedente },
    { label: "Enf. y maternidad: prestaciones en dinero", dailyBase: breakdown.sbc_topado, days: breakdown.dias_eym, rate: breakdown.tasa_eym_dinero, amount: breakdown.importe_eym_dinero },
    { label: "Enf. y maternidad: gastos médicos de pensionados", dailyBase: breakdown.sbc_topado, days: breakdown.dias_eym, rate: breakdown.tasa_eym_pensionados, amount: breakdown.importe_eym_pensionados },
    { label: "Invalidez y vida", dailyBase: breakdown.sbc_topado, days: breakdown.dias_iv_ceav, rate: breakdown.tasa_iv, amount: breakdown.importe_iv },
    { label: "Cesantía en edad avanzada y vejez", dailyBase: breakdown.sbc_topado, days: breakdown.dias_iv_ceav, rate: breakdown.tasa_ceav, amount: breakdown.importe_ceav },
  ];
}

/** Desglose de la cuota obrera calculada: los 5 ramos, el SBC usado y la vigencia de cada dato (spec 91). */
function ImssCalculationDetail({ breakdown }: { breakdown: IImssBreakdown }) {
  return (
    <div className="mt-3 rounded-lg bg-[#f8f9ff] dark:bg-zinc-800/50 px-4 py-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            <tr>
              <th scope="col" className="py-1.5 pr-3">Ramo</th>
              <th scope="col" className="py-1.5 px-2 text-right">Base diaria</th>
              <th scope="col" className="py-1.5 px-2 text-right">Días</th>
              <th scope="col" className="py-1.5 px-2 text-right">Tasa</th>
              <th scope="col" className="py-1.5 pl-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-[#0b1c30] dark:text-zinc-200">
            {buildBranchLines(breakdown).map((line) => (
              <tr key={line.label}>
                <td className="py-1.5 pr-3 text-[#44474f] dark:text-zinc-400">{line.label}</td>
                <td className="py-1.5 px-2 text-right">{formatPayrollCurrency(line.dailyBase)}</td>
                <td className="py-1.5 px-2 text-right">{line.days}</td>
                <td className="py-1.5 px-2 text-right">{PLAIN_NUMBER_FORMATTER.format(line.rate)}%</td>
                <td className="py-1.5 pl-2 text-right">{formatPayrollCurrency(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="mt-2">
        <PayrollCalculationRow label="Cuota causada" value={formatPayrollCurrency(breakdown.cuota_causada)} />
        <PayrollCalculationRow label="IMSS retenido" value={formatPayrollCurrency(breakdown.imss_retenido)} emphasized />
      </dl>

      {breakdown.exento_salario_minimo && (
        <p className="mt-3 flex gap-2 rounded-lg bg-[#dce9ff]/60 dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-200">
          <Info size={16} className="shrink-0 mt-0.5" aria-hidden />
          <span>
            No se retiene: el salario diario no supera el salario mínimo ({formatPayrollCurrency(breakdown.salario_minimo)},
            art. 36 LSS). La cuota causada de {formatPayrollCurrency(breakdown.cuota_causada)} la absorbe el patrón.
          </span>
        </p>
      )}
      {breakdown.topado_al_neto && (
        <p className="mt-3 flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          <TriangleAlert size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
          <span>
            Se retuvo solo {formatPayrollCurrency(breakdown.imss_retenido)} de los {formatPayrollCurrency(breakdown.cuota_causada)}{" "}
            causados: es lo que alcanza de las percepciones menos el ISR. La diferencia la absorbe el patrón y no se cobra después.
          </span>
        </p>
      )}

      <ul className="mt-3 flex flex-col gap-0.5 text-xs text-[#747780] dark:text-zinc-500">
        <li>
          SBC {formatPayrollCurrency(breakdown.sbc)}, {describeEffectiveDate(breakdown.sbc_vigente_desde)}
        </li>
        <li>
          SBC topado {formatPayrollCurrency(breakdown.sbc_topado)} (tope de {PLAIN_NUMBER_FORMATTER.format(breakdown.tope_sbc_umas)}{" "}
          UMA = {formatPayrollCurrency(breakdown.tope_sbc)})
        </li>
        <li>
          Excedente sobre {PLAIN_NUMBER_FORMATTER.format(breakdown.umbral_excedente_umas)} UMA ({formatPayrollCurrency(breakdown.umbral_excedente)})
        </li>
        <li>
          UMA diaria {formatPayrollCurrency(breakdown.uma_diaria)}, {describeEffectiveDate(breakdown.uma_vigente_desde)}
        </li>
        <li>
          Salario mínimo {formatPayrollCurrency(breakdown.salario_minimo)}, {describeEffectiveDate(breakdown.salario_minimo_vigente_desde)}
        </li>
        <li>Tasas y límites {describeEffectiveDate(breakdown.parametros_vigente_desde)}</li>
        <li>Días: {breakdown.dias_eym} calendario en enfermedad y maternidad; {breakdown.dias_iv_ceav} pagados (sin faltas) en invalidez y vida, y en cesantía y vejez</li>
      </ul>
    </div>
  );
}

const EMPLOYEE_REASONS: ReadonlySet<ImssSkipReason> = new Set<ImssSkipReason>(["missing_nss", "missing_sbc"]);

/** Línea "IMSS" de la tarjeta de deducciones del Detalle fiscal (spec 91): importe y desglose, motivo o aviso. */
export default function PayrollImssDeduction({
  imssStatus,
  imssSkipReason,
  imssWithheld,
  imssBreakdown,
  contributionRegime,
  employeeId,
  fiscalYear,
}: Props) {
  const appliesToEmployee = contributionRegime === IMSS_CONTRIBUTION_REGIME;

  return (
    <div className="flex items-start gap-3">
      <span className="w-9 h-9 shrink-0 mt-0.5 rounded-lg bg-[#dce9ff] dark:bg-zinc-800 text-[#0051d5] dark:text-blue-300 flex items-center justify-center">
        <ShieldCheck size={18} aria-hidden />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">IMSS</span>
            <span className="mt-0.5 text-sm text-[#44474f] dark:text-zinc-400">Cuota obrera sobre el SBC del empleado</span>
          </div>
          {imssStatus === "C" && imssWithheld !== null && (
            <span className="shrink-0 text-base font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-50">
              {formatPayrollCurrency(imssWithheld)}
            </span>
          )}
        </div>

        {imssStatus === "C" && imssBreakdown && <ImssCalculationDetail breakdown={imssBreakdown} />}

        {imssStatus === "N" && imssSkipReason && (
          <p className="mt-3 flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            <TriangleAlert size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
            <span>
              <span className="font-semibold">IMSS no calculado.</span> {describeImssSkipReason(imssSkipReason)}.{" "}
              {EMPLOYEE_REASONS.has(imssSkipReason) ? (
                <>
                  Captúralo en el{" "}
                  <Link
                    href={`/dashboard/empleados/${employeeId}/imss`}
                    className="font-medium text-[#0051d5] dark:text-blue-300 underline-offset-2 hover:underline"
                  >
                    expediente del empleado
                  </Link>{" "}
                  y recalcula la nómina.
                </>
              ) : (
                <>
                  Captura lo que falta en{" "}
                  <Link
                    href={buildTaxParametersHref("parameters", fiscalYear)}
                    className="font-medium text-[#0051d5] dark:text-blue-300 underline-offset-2 hover:underline"
                  >
                    Parámetros fiscales
                  </Link>{" "}
                  y recalcula la nómina.
                </>
              )}
            </span>
          </p>
        )}

        {imssStatus === "X" && (
          <p className="mt-3 flex gap-2 rounded-lg bg-[#f8f9ff] dark:bg-zinc-800/50 px-3 py-2 text-sm text-[#44474f] dark:text-zinc-300">
            <Info size={16} className="shrink-0 mt-0.5" aria-hidden />
            {appliesToEmployee
              ? "Recalcula la nómina para ver el IMSS"
              : `No aplica: el empleado no está en el régimen de sueldos (${IMSS_CONTRIBUTION_REGIME}).`}
          </p>
        )}
      </div>
    </div>
  );
}
