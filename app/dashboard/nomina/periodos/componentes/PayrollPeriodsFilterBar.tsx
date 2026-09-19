"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { PAYROLL_PERIOD_STATUS } from "@/lib/payroll/constants";

interface Props {
  frequencyCounts: { id_payment_period: number; description: string; total: number }[];
  availableYears: number[];
  selectedFrequencyId: number | null;
  selectedStatus: number | null;
  selectedYear: number;
  searchText: string;
}

const SEARCH_DEBOUNCE_MILLISECONDS = 350;

const CONTROL_CLASSES =
  "rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all";

/** Único componente cliente de la lista: cada control solo reescribe los `searchParams` de la URL. */
export default function PayrollPeriodsFilterBar({
  frequencyCounts,
  availableYears,
  selectedFrequencyId,
  selectedStatus,
  selectedYear,
  searchText,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchInput, setSearchInput] = useState(searchText);

  function replaceFilters(changes: Record<string, string | null>) {
    const nextSearchParams = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") nextSearchParams.delete(key);
      else nextSearchParams.set(key, value);
    }
    nextSearchParams.delete("pagina");
    const query = nextSearchParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  useEffect(() => {
    if (searchInput.trim() === searchText) return;
    const timeoutId = setTimeout(() => replaceFilters({ q: searchInput.trim() }), SEARCH_DEBOUNCE_MILLISECONDS);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const totalInYear = frequencyCounts.reduce((sum, frequency) => sum + frequency.total, 0);
  const tabs = [
    { id: null, label: "Todos", total: totalInYear },
    ...frequencyCounts.map((frequency) => ({
      id: frequency.id_payment_period,
      label: frequency.description,
      total: frequency.total,
    })),
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-4 flex flex-col gap-4">
      <div role="tablist" aria-label="Frecuencia" className="flex flex-wrap gap-1 rounded-lg bg-[#eff4ff] dark:bg-zinc-800 p-1 self-start">
        {tabs.map((tab) => {
          const isSelected = tab.id === selectedFrequencyId;
          return (
            <button
              key={tab.id ?? "all"}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => replaceFilters({ frecuencia: tab.id === null ? null : String(tab.id) })}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                isSelected
                  ? "bg-white dark:bg-zinc-700 text-[#0b1c30] dark:text-zinc-50 font-semibold shadow-sm"
                  : "text-[#44474f] dark:text-zinc-400 hover:text-[#0b1c30] dark:hover:text-zinc-100"
              }`}
            >
              {tab.label} ({tab.total})
            </button>
          );
        })}
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <select
          aria-label="Estatus"
          value={selectedStatus ?? ""}
          onChange={(event) => replaceFilters({ estatus: event.target.value })}
          className={`${CONTROL_CLASSES} md:w-52`}
        >
          <option value="">Todos los estatus</option>
          {Object.entries(PAYROLL_PERIOD_STATUS).map(([statusId, { label }]) => (
            <option key={statusId} value={statusId}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Ejercicio"
          value={selectedYear}
          onChange={(event) => replaceFilters({ ejercicio: event.target.value })}
          className={`${CONTROL_CLASSES} md:w-44`}
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              Ejercicio {year}
            </option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747780] dark:text-zinc-500"
          />
          <input
            type="text"
            placeholder="Buscar por código…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className={`${CONTROL_CLASSES} w-full pl-10 bg-[#eff4ff] dark:bg-zinc-800 placeholder-[#747780] dark:placeholder-zinc-500`}
          />
        </div>
      </div>
    </div>
  );
}
