import type { ReactNode } from "react";
import type { IPtuDistribution } from "@/interfaces/payroll_ptu";
import { PTU_TRUST_SALARY_CAP_FACTOR } from "@/lib/payroll/constants";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

const CARD_BASE = "rounded-xl border p-5 shadow-sm";
const CARD_PLAIN = `${CARD_BASE} bg-white dark:bg-zinc-900 border-[#c4c6d0] dark:border-zinc-700`;
const CARD_LABEL = "text-xs font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400";
const CARD_VALUE = "mt-1 text-2xl font-bold tabular-nums text-[#0b1c30] dark:text-zinc-50";

function DetailLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-[#44474f] dark:text-zinc-400">{label}</dt>
      <dd className="font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100">{value}</dd>
    </div>
  );
}

/** Resumen del reparto: fondo, mitades, totales del cálculo, factores, total repartido y remanente. */
export default function PtuDistributionSummaryCards({ distribution }: { distribution: IPtuDistribution }) {
  const totalRemainder = distribution.remanente_topes + distribution.remanente_redondeo;

  return (
    <section aria-label="Resumen del reparto" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <div className={`${CARD_BASE} bg-[#0051d5]/5 dark:bg-blue-900/20 border-[#0051d5]/25 dark:border-blue-800`}>
        <p className={CARD_LABEL}>Fondo a repartir</p>
        <p className={CARD_VALUE}>{formatPayrollCurrency(distribution.fondo)}</p>
        <p className="mt-1 text-xs text-[#44474f] dark:text-zinc-400">
          10% de {formatPayrollCurrency(distribution.renta_gravable)}
          {distribution.ptu_no_cobrada_anterior > 0 &&
            ` más ${formatPayrollCurrency(distribution.ptu_no_cobrada_anterior)} no cobrados`}
        </p>
      </div>

      <div className={CARD_PLAIN}>
        <p className={CARD_LABEL}>Mitades</p>
        <dl className="mt-3 flex flex-col gap-2">
          <DetailLine label="Por días trabajados" value={formatPayrollCurrency(distribution.mitad_dias)} />
          <DetailLine label="Por salario" value={formatPayrollCurrency(distribution.mitad_salario)} />
        </dl>
      </div>

      <div className={CARD_PLAIN}>
        <p className={CARD_LABEL}>Base del reparto</p>
        <dl className="mt-3 flex flex-col gap-2">
          <DetailLine label="Total de días" value={distribution.total_dias.toLocaleString("es-MX")} />
          <DetailLine label="Total de salario" value={formatPayrollCurrency(distribution.total_salario_reparto)} />
        </dl>
        <p className="mt-2 text-xs text-[#747780] dark:text-zinc-500">Solo trabajadores elegibles.</p>
      </div>

      <div className={CARD_PLAIN}>
        <p className={CARD_LABEL}>Factores</p>
        <dl className="mt-3 flex flex-col gap-2">
          <DetailLine label="3 meses de salario" value={`${distribution.factor_tres_meses} días`} />
          <DetailLine
            label={`Tope de confianza (${PTU_TRUST_SALARY_CAP_FACTOR * 100}%)`}
            value={
              distribution.tope_salario_diario_confianza === null
                ? "Sin tope"
                : `${formatPayrollCurrency(distribution.tope_salario_diario_confianza)} / día`
            }
          />
        </dl>
      </div>

      <div className={CARD_PLAIN}>
        <p className={CARD_LABEL}>Total repartido</p>
        <p className={CARD_VALUE}>{formatPayrollCurrency(distribution.total_repartido)}</p>
      </div>

      <div className={CARD_PLAIN}>
        <p className={CARD_LABEL}>Remanente sin repartir</p>
        <p className={CARD_VALUE}>{formatPayrollCurrency(totalRemainder)}</p>
        <dl className="mt-2 flex flex-col gap-1">
          <DetailLine label="Excede los topes" value={formatPayrollCurrency(distribution.remanente_topes)} />
          <DetailLine label="Redondeo" value={formatPayrollCurrency(distribution.remanente_redondeo)} />
        </dl>
      </div>
    </section>
  );
}
