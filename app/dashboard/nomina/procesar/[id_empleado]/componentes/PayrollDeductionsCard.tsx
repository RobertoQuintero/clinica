import { CircleMinus, Info, Landmark, TriangleAlert } from "lucide-react";
import type { IIsrBreakdown } from "@/interfaces/payroll_isr";
import { describeIsrSkipReason } from "@/lib/payroll/isrCalculation";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { formatPeriodDate } from "@/lib/payroll/periodFormat";

interface Props {
  isrBreakdown: IIsrBreakdown;
  totalPerceptions: number;
  totalDeductions: number;
}

const PLAIN_NUMBER_FORMATTER = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 4 });

/** "límite inferior $1,650.68, cuota $96.95, 10.88% sobre excedente"; sin tramo cuando la base es 0. */
function describeBracket(isrBreakdown: IIsrBreakdown): string {
  if (isrBreakdown.isr_limite_inferior === null) return "Sin tramo: la base es $0.00";
  return `Límite inferior ${formatPayrollCurrency(isrBreakdown.isr_limite_inferior)}, cuota ${formatPayrollCurrency(
    isrBreakdown.isr_cuota_fija ?? 0,
  )}, ${PLAIN_NUMBER_FORMATTER.format(isrBreakdown.isr_porcentaje_excedente ?? 0)}% sobre excedente`;
}

function describeEffectiveDate(effectiveDate: string | null): string {
  return effectiveDate ? `vigente desde el ${formatPeriodDate(effectiveDate)}` : "sin vigencia";
}

function CalculationRow({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-1.5 ${
        emphasized ? "mt-1 border-t border-[#e5e8f0] dark:border-zinc-700 pt-2.5" : ""
      }`}
    >
      <dt className={`text-sm ${emphasized ? "font-semibold text-[#0b1c30] dark:text-zinc-100" : "text-[#44474f] dark:text-zinc-400"}`}>
        {label}
      </dt>
      <dd
        className={`text-sm text-right tabular-nums ${
          emphasized ? "font-semibold text-[#0b1c30] dark:text-zinc-50" : "text-[#0b1c30] dark:text-zinc-200"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

/** Desglose del ISR calculado: base, tramo, causado, subsidio, retenido y la vigencia de cada dato usado. */
function IsrCalculationDetail({ isrBreakdown }: { isrBreakdown: IIsrBreakdown }) {
  return (
    <div className="mt-3 rounded-lg bg-[#f8f9ff] dark:bg-zinc-800/50 px-4 py-3">
      <dl>
        <CalculationRow label="Base gravable" value={formatPayrollCurrency(isrBreakdown.isr_base_gravable ?? 0)} />
        <div className="py-1.5">
          <dt className="text-sm text-[#44474f] dark:text-zinc-400">Tramo</dt>
          <dd className="mt-0.5 text-sm tabular-nums text-[#0b1c30] dark:text-zinc-200">{describeBracket(isrBreakdown)}</dd>
        </div>
        <CalculationRow label="ISR causado" value={formatPayrollCurrency(isrBreakdown.isr_causado ?? 0)} />
        <CalculationRow
          label="Subsidio causado"
          value={
            isrBreakdown.subsidio_con_derecho
              ? formatPayrollCurrency(isrBreakdown.subsidio_causado ?? 0)
              : "Sin derecho: ingreso mayor al tope"
          }
        />
        <CalculationRow
          label="Subsidio aplicado"
          value={`− ${formatPayrollCurrency(isrBreakdown.subsidio_aplicado ?? 0)}`}
        />
        <CalculationRow label="ISR retenido" value={formatPayrollCurrency(isrBreakdown.isr_retenido ?? 0)} emphasized />
      </dl>
      <ul className="mt-3 flex flex-col gap-0.5 text-xs text-[#747780] dark:text-zinc-500">
        <li>Tarifa del ejercicio {isrBreakdown.isr_ejercicio_tarifa}</li>
        <li>
          Subsidio mensual {formatPayrollCurrency(isrBreakdown.subsidio_monto_mensual ?? 0)},{" "}
          {describeEffectiveDate(isrBreakdown.subsidio_monto_vigente_desde)}
        </li>
        <li>
          Tope de ingreso mensual {formatPayrollCurrency(isrBreakdown.subsidio_tope_ingreso_mensual ?? 0)},{" "}
          {describeEffectiveDate(isrBreakdown.subsidio_tope_vigente_desde)}
        </li>
        <li>
          Factor de {PLAIN_NUMBER_FORMATTER.format(isrBreakdown.subsidio_factor_dias_mes ?? 0)} días por mes,{" "}
          {describeEffectiveDate(isrBreakdown.subsidio_factor_vigente_desde)}
        </li>
      </ul>
    </div>
  );
}

/** Tarjeta "Deducciones" del Detalle, solo en la vista fiscal (spec 70). Hoy la única deducción es el ISR. */
export default function PayrollDeductionsCard({ isrBreakdown, totalPerceptions, totalDeductions }: Props) {
  const netPay = Math.round((totalPerceptions - totalDeductions) * 100) / 100;

  return (
    <section
      aria-labelledby="payroll-deductions-title"
      className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden"
    >
      <header className="px-5 py-4 bg-[#f8f9ff] dark:bg-zinc-800/60 border-b border-[#e5e8f0] dark:border-zinc-700 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-[#ba1a1a]/10 dark:bg-red-900/30 text-[#ba1a1a] dark:text-red-400 flex items-center justify-center">
            <CircleMinus size={20} aria-hidden />
          </span>
          <h3 id="payroll-deductions-title" className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">
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
                <span className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">ISR</span>
                <span className="mt-0.5 text-sm text-[#44474f] dark:text-zinc-400">
                  Tarifa del periodo menos subsidio para el empleo
                </span>
              </div>
              {isrBreakdown.isr_estado === "C" && (
                <span className="shrink-0 text-base font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-50">
                  {formatPayrollCurrency(isrBreakdown.isr_retenido ?? 0)}
                </span>
              )}
            </div>

            {isrBreakdown.isr_estado === "C" && <IsrCalculationDetail isrBreakdown={isrBreakdown} />}

            {isrBreakdown.isr_estado === "N" && isrBreakdown.isr_motivo && (
              <p className="mt-3 flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
                <TriangleAlert size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
                <span>
                  <span className="font-semibold">ISR no calculado.</span> {describeIsrSkipReason(isrBreakdown.isr_motivo)}.
                  Captura lo que falta en Parámetros fiscales y recalcula la nómina.
                </span>
              </p>
            )}

            {isrBreakdown.isr_estado === "X" && (
              <p className="mt-3 flex gap-2 rounded-lg bg-[#f8f9ff] dark:bg-zinc-800/50 px-3 py-2 text-sm text-[#44474f] dark:text-zinc-300">
                <Info size={16} className="shrink-0 mt-0.5" aria-hidden />
                Recalcula la nómina para ver el ISR
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
