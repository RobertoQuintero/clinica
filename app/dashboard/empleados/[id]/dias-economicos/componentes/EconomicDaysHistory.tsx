import type { IEconomicDaysYear } from "@/interfaces/economic_day";
import { ECONOMIC_DAYS_PER_YEAR } from "@/lib/economicDays/economicDayRules";
import EconomicDayRow from "./EconomicDayRow";

interface Props {
  previousYears: IEconomicDaysYear[];
}

/** Años anteriores, solo lectura. Un `<details>` por año (sin JS). */
export default function EconomicDaysHistory({ previousYears }: Props) {
  const yearsWithDays = previousYears.filter((yearSummary) => yearSummary.days.length > 0);
  if (yearsWithDays.length === 0) return null;

  return (
    <section aria-label="Historial de años anteriores" className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#74777f] dark:text-zinc-500">
        Años anteriores
      </h3>
      {yearsWithDays.map((yearSummary) => (
        <details
          key={yearSummary.year}
          className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm"
        >
          <summary className="px-5 py-3 cursor-pointer flex flex-wrap items-center gap-3">
            <span className="text-base font-bold text-[#0b1c30] dark:text-zinc-50">
              {yearSummary.year}
            </span>
            <span className="text-sm text-[#44474f] dark:text-zinc-400">
              Usados {yearSummary.usedDays} de {ECONOMIC_DAYS_PER_YEAR}
            </span>
          </summary>
          <ul className="divide-y divide-[#c4c6d0] dark:divide-zinc-700 border-t border-[#c4c6d0] dark:border-zinc-700">
            {yearSummary.days.map((economicDay) => (
              <EconomicDayRow key={economicDay.id_economic_day} economicDay={economicDay} />
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
