"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { IPayrollPeriod } from "@/interfaces/payroll_period";
import { formatPeriodRange } from "@/lib/payroll/periodFormat";

export interface IStatusFilterOption {
  value: string;
  label: string;
  /** Valor que se escribe en `?estado=`; null para "Todas", que no aparece en la URL. */
  urlValue: string | null;
}

/** Segundo grupo de filtros (p. ej. la clasificación en Retardos), que se escribe en `?{urlKey}=`. */
export interface IExtraFilter {
  groupLabel: string;
  urlKey: string;
  options: IStatusFilterOption[];
  selected: string;
}

interface Props {
  periodOptions: Pick<IPayrollPeriod, "id_period" | "codigo" | "fecha_inicio" | "fecha_fin" | "status">[];
  selectedPeriodId: number;
  /** Grupo principal `?estado=`; se omite en pantallas que solo filtran con `extraFilter` (Bonos). */
  statusGroupLabel?: string;
  statusOptions?: IStatusFilterOption[];
  selectedStatus?: string;
  searchText: string;
  extraFilter?: IExtraFilter;
}

const SEARCH_DEBOUNCE_MILLISECONDS = 350;

const CONTROL_CLASSES =
  "rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all";

interface FilterRadioGroupProps {
  groupLabel: string;
  options: IStatusFilterOption[];
  selected: string;
  onSelect: (urlValue: string | null) => void;
}

function FilterRadioGroup({ groupLabel, options, selected, onSelect }: FilterRadioGroupProps) {
  return (
    <div
      role="radiogroup"
      aria-label={groupLabel}
      className="flex flex-wrap gap-1 rounded-lg bg-[#eff4ff] dark:bg-zinc-800 p-1 self-start"
    >
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(option.urlValue)}
            className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
              isSelected
                ? "bg-white dark:bg-zinc-700 text-[#0b1c30] dark:text-zinc-50 font-semibold shadow-sm"
                : "text-[#44474f] dark:text-zinc-400 hover:text-[#0b1c30] dark:hover:text-zinc-100"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Barra de filtros de las pantallas de nómina por periodo (Horas extra, Faltas y Retardos): periodo, estado,
 * un filtro extra opcional y búsqueda.
 * Cada control reescribe los `searchParams` y reinicia la paginación.
 */
export default function PayrollPeriodFilterToolbar({
  periodOptions,
  selectedPeriodId,
  statusGroupLabel,
  statusOptions,
  selectedStatus,
  searchText,
  extraFilter,
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

  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-4">
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

        {statusOptions && statusGroupLabel !== undefined && selectedStatus !== undefined && (
          <FilterRadioGroup
            groupLabel={statusGroupLabel}
            options={statusOptions}
            selected={selectedStatus}
            onSelect={(urlValue) => replaceFilters({ estado: urlValue })}
          />
        )}
        {extraFilter && (
          <FilterRadioGroup
            groupLabel={extraFilter.groupLabel}
            options={extraFilter.options}
            selected={extraFilter.selected}
            onSelect={(urlValue) => replaceFilters({ [extraFilter.urlKey]: urlValue })}
          />
        )}
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
