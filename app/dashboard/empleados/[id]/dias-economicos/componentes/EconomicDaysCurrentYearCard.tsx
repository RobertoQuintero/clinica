import type { ReactNode } from "react";
import type { IEconomicDaysYear } from "@/interfaces/economic_day";
import { ECONOMIC_DAYS_PER_YEAR } from "@/lib/economicDays/economicDayRules";
import EconomicDayRow from "./EconomicDayRow";

interface Props {
  yearSummary: IEconomicDaysYear;
  /** Botón "Registrar día económico"; el padre decide si va deshabilitado. */
  registerAction?: ReactNode;
}

export default function EconomicDaysCurrentYearCard({ yearSummary, registerAction }: Props) {
  return (
    <section
      aria-label={`Días económicos ${yearSummary.year}`}
      className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm"
    >
      <header className="p-5 border-b border-[#c4c6d0] dark:border-zinc-700 flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-bold text-[#0b1c30] dark:text-zinc-50">{yearSummary.year}</h3>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Usados <strong className="tabular-nums">{yearSummary.usedDays}</strong> de{" "}
          {ECONOMIC_DAYS_PER_YEAR} · Disponibles{" "}
          <strong className="tabular-nums">{yearSummary.availableDays}</strong>
        </p>
        {registerAction && <div className="sm:ml-auto">{registerAction}</div>}
      </header>

      {yearSummary.days.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-[#74777f] dark:text-zinc-500">
          Sin días económicos registrados este año.
        </p>
      ) : (
        <ul className="divide-y divide-[#c4c6d0] dark:divide-zinc-700">
          {yearSummary.days.map((economicDay) => (
            <EconomicDayRow key={economicDay.id_economic_day} economicDay={economicDay} />
          ))}
        </ul>
      )}
    </section>
  );
}
