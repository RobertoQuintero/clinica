import { CircleMinus, Landmark, TriangleAlert } from "lucide-react";
import type { IArticle174IsrBreakdown } from "@/interfaces/payroll_christmas_bonus";
import type { ExtraordinaryConcept } from "@/interfaces/payroll_period";
import { describeArticle174SkipReason } from "@/lib/payroll/isrArticle174";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { buildTaxParametersHref } from "@/lib/payroll/taxParametersUrls";
import Link from "next/link";
import { PayrollCalculationRow } from "./PayrollCalculationRow";

interface Props {
  breakdown: IArticle174IsrBreakdown | null;
  totalPerceptions: number;
  totalDeductions: number;
  fiscalYear: number;
  /** Qué se paga en el periodo extraordinario: cambia solo los textos (aguinaldo o PTU). */
  concept?: ExtraordinaryConcept;
}

const CONCEPT_TEXT: Record<ExtraordinaryConcept, { taxed: string; monthlyPart: string; isr: string; missing: string }> = {
  A: {
    taxed: "Gravado del aguinaldo",
    monthlyPart: "Parte mensualizada del aguinaldo",
    isr: "ISR del aguinaldo",
    missing: "Este empleado no tiene aguinaldo con ISR calculado. Recalcula la nómina.",
  },
  P: {
    taxed: "Gravado de la PTU",
    monthlyPart: "Parte mensualizada de la PTU",
    isr: "ISR de la PTU",
    missing: "Este empleado no tiene PTU con ISR calculado. Recalcula la nómina.",
  },
};

const PLAIN_NUMBER_FORMATTER = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 4 });

/** "Límite inferior $14,644.65, cuota $1,339.14, 17.92% sobre excedente". */
function describeBracket(lowerLimit: number | null, fixedFee: number | null, percentage: number | null): string {
  if (lowerLimit === null) return "Sin tramo";
  return `Límite inferior ${formatPayrollCurrency(lowerLimit)}, cuota ${formatPayrollCurrency(fixedFee ?? 0)}, ${PLAIN_NUMBER_FORMATTER.format(percentage ?? 0)}% sobre excedente`;
}

/** Tasa guardada con 6 decimales como porcentaje: 0.179133 -> "17.9133%". */
function formatRateAsPercentage(rate: number): string {
  return `${PLAIN_NUMBER_FORMATTER.format(Math.round(rate * 1_000_000) / 10_000)}%`;
}

function BracketLine({ label, bracketText }: { label: string; bracketText: string }) {
  return (
    <div className="py-1.5">
      <dt className="text-sm text-[#44474f] dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm tabular-nums text-[#0b1c30] dark:text-zinc-200">{bracketText}</dd>
    </div>
  );
}

/** Cada paso del art. 174 con lo que congeló el cálculo: ordinario mensual, parte mensualizada, ISR de cada tarifa y tasa. */
function Article174CalculationDetail({
  breakdown,
  concept,
}: {
  breakdown: IArticle174IsrBreakdown;
  concept: ExtraordinaryConcept;
}) {
  const usesBracket = breakdown.limite_inferior_ordinario !== null;
  return (
    <div className="mt-3 rounded-lg bg-[#f8f9ff] dark:bg-zinc-800/50 px-4 py-3">
      <dl>
        <PayrollCalculationRow label={CONCEPT_TEXT[concept].taxed} value={formatPayrollCurrency(breakdown.base_gravable ?? 0)} />
        <PayrollCalculationRow
          label="Ingreso ordinario mensual"
          value={formatPayrollCurrency(breakdown.ingreso_ordinario_mensual ?? 0)}
        />
        <PayrollCalculationRow
          label={CONCEPT_TEXT[concept].monthlyPart}
          value={formatPayrollCurrency(breakdown.parte_mensualizada ?? 0)}
        />
        {usesBracket && (
          <BracketLine
            label="Tramo del ingreso ordinario"
            bracketText={describeBracket(
              breakdown.limite_inferior_ordinario,
              breakdown.cuota_fija_ordinario,
              breakdown.porcentaje_ordinario,
            )}
          />
        )}
        <PayrollCalculationRow label="ISR del ingreso ordinario" value={formatPayrollCurrency(breakdown.isr_ordinario ?? 0)} />
        {usesBracket && (
          <BracketLine
            label="Tramo del ordinario + parte mensualizada"
            bracketText={describeBracket(
              breakdown.limite_inferior_total,
              breakdown.cuota_fija_total,
              breakdown.porcentaje_total,
            )}
          />
        )}
        <PayrollCalculationRow label="ISR del ordinario + parte" value={formatPayrollCurrency(breakdown.isr_total ?? 0)} />
        <PayrollCalculationRow label="Diferencia de ISR" value={formatPayrollCurrency(breakdown.diferencia_isr ?? 0)} />
        <PayrollCalculationRow label="Tasa (diferencia ÷ parte mensualizada)" value={formatRateAsPercentage(breakdown.tasa ?? 0)} />
        <PayrollCalculationRow label="ISR retenido" value={formatPayrollCurrency(breakdown.isr_retenido ?? 0)} emphasized />
      </dl>
      <p className="mt-3 text-xs text-[#747780] dark:text-zinc-500">
        Tarifa mensual del ejercicio {breakdown.ejercicio_tarifa}. Sin subsidio para el empleo.
      </p>
    </div>
  );
}

/** Tarjeta "Deducciones" del Detalle fiscal de un periodo extraordinario: ISR del aguinaldo o de la PTU por el art. 174 RLISR (specs 87 y 90). */
export default function PayrollArticle174IsrCard({
  breakdown,
  totalPerceptions,
  totalDeductions,
  fiscalYear,
  concept = "A",
}: Props) {
  const netPay = Math.round((totalPerceptions - totalDeductions) * 100) / 100;

  return (
    <section
      aria-labelledby="payroll-article174-title"
      className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden"
    >
      <header className="px-5 py-4 bg-[#f8f9ff] dark:bg-zinc-800/60 border-b border-[#e5e8f0] dark:border-zinc-700 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-[#ba1a1a]/10 dark:bg-red-900/30 text-[#ba1a1a] dark:text-red-400 flex items-center justify-center">
            <CircleMinus size={20} aria-hidden />
          </span>
          <h3 id="payroll-article174-title" className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">
            Deducciones
          </h3>
        </div>
        <div className="text-right">
          <span className="block text-xl font-bold tabular-nums text-[#ba1a1a] dark:text-red-400">
            {formatPayrollCurrency(totalDeductions)}
          </span>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            MXN
          </span>
        </div>
      </header>

      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 shrink-0 mt-0.5 rounded-lg bg-[#dce9ff] dark:bg-zinc-800 text-[#0051d5] dark:text-blue-300 flex items-center justify-center">
            <Landmark size={18} aria-hidden />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">{CONCEPT_TEXT[concept].isr}</span>
                <span className="mt-0.5 text-sm text-[#44474f] dark:text-zinc-400">
                  Art. 174 RLISR sobre el gravado, con la tarifa mensual
                </span>
              </div>
              {breakdown?.isr_estado === "C" && (
                <span className="shrink-0 text-base font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-50">
                  {formatPayrollCurrency(breakdown.isr_retenido ?? 0)}
                </span>
              )}
            </div>

            {breakdown?.isr_estado === "C" && <Article174CalculationDetail breakdown={breakdown} concept={concept} />}

            {breakdown?.isr_estado === "N" && breakdown.isr_motivo && (
              <p className="mt-3 flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
                <TriangleAlert size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
                <span>
                  <span className="font-semibold">ISR no calculado.</span> {describeArticle174SkipReason(breakdown.isr_motivo)}.{" "}
                  <Link
                    href={buildTaxParametersHref(
                      breakdown.isr_motivo === "exemption_not_calculated" ? "parameters" : "withholding",
                      fiscalYear,
                      "monthly",
                    )}
                    className="font-medium text-[#0051d5] dark:text-blue-300 underline-offset-2 hover:underline"
                  >
                    Revisar Parámetros fiscales
                  </Link>{" "}
                  y recalcula la nómina.
                </span>
              </p>
            )}

            {!breakdown && (
              <p className="mt-3 rounded-lg bg-[#f8f9ff] dark:bg-zinc-800/50 px-3 py-2 text-sm text-[#44474f] dark:text-zinc-300">
                {CONCEPT_TEXT[concept].missing}
              </p>
            )}
          </div>
        </div>
      </div>

      <footer className="px-5 py-4 border-t border-[#e5e8f0] dark:border-zinc-700 bg-[#dce9ff]/50 dark:bg-zinc-800 flex flex-col gap-1.5">
        <p className="text-sm text-[#44474f] dark:text-zinc-400 tabular-nums">
          Percepciones {formatPayrollCurrency(totalPerceptions)} − deducciones {formatPayrollCurrency(totalDeductions)}
        </p>
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm font-bold uppercase tracking-wider text-[#0b1c30] dark:text-zinc-100">Neto a pagar</span>
          <span className="text-xl font-bold tabular-nums text-[#0051d5] dark:text-blue-300">{formatPayrollCurrency(netPay)}</span>
        </div>
      </footer>
    </section>
  );
}
