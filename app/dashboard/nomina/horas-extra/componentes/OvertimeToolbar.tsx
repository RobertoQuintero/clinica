"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { IOvertimePage, OvertimeStatusFilter } from "@/interfaces/payroll_overtime";
import { formatPeriodRange } from "@/lib/payroll/periodFormat";
import { OVERTIME_STATUS_URL_VALUES } from "@/lib/payroll/overtimeUrls";

interface Props {
  periodOptions: IOvertimePage["periodOptions"];
  selectedPeriodId: number;
  selectedStatus: OvertimeStatusFilter;
  searchText: string;
}

const SEARCH_DEBOUNCE_MILLISECONDS = 350;

const CONTROL_CLASSES =
  "rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all";

const STATUS_OPTIONS: { value: OvertimeStatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "authorized", label: "Autorizadas" },
  { value: "rejected", label: "Rechazadas" },
];

/** Único componente cliente de la lista: cada control reescribe los `searchParams` y reinicia la paginación. */
export default function OvertimeToolbar({ periodOptions, selectedPeriodId, selectedStatus, searchText }: Props) {
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

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <select
          aria-label="Periodo"
          value={selectedPeriodId}
          onChange={(event) => replaceFilters({ periodo: event.target.value })}
          className={`${CONTROL_CLASSES} md:w-80`}
        >
          {periodOptions.map((periodOption) => (
            <option key={periodOption.id_period} value={periodOption.id_period}>
              {periodOption.codigo} · {formatPeriodRange(periodOption.fecha_inicio, periodOption.fecha_fin)}
            </option>
          ))}
        </select>

        <div
          role="radiogroup"
          aria-label="Estado de la decisión"
          className="flex gap-1 rounded-lg bg-[#eff4ff] dark:bg-zinc-800 p-1 self-start"
        >
          {STATUS_OPTIONS.map((statusOption) => {
            const isSelected = statusOption.value === selectedStatus;
            return (
              <button
                key={statusOption.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() =>
                  replaceFilters({
                    estado: statusOption.value === "all" ? null : OVERTIME_STATUS_URL_VALUES[statusOption.value],
                  })
                }
                className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                  isSelected
                    ? "bg-white dark:bg-zinc-700 text-[#0b1c30] dark:text-zinc-50 font-semibold shadow-sm"
                    : "text-[#44474f] dark:text-zinc-400 hover:text-[#0b1c30] dark:hover:text-zinc-100"
                }`}
              >
                {statusOption.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747780] dark:text-zinc-500"
        />
        <input
          type="text"
          aria-label="Buscar empleado"
          placeholder="Buscar por nombre o código…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className={`${CONTROL_CLASSES} w-full pl-10 bg-[#eff4ff] dark:bg-zinc-800 placeholder-[#747780] dark:placeholder-zinc-500`}
        />
      </div>
    </div>
  );
}
