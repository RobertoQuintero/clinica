"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { IPayrollProcessPage, PayrollType } from "@/interfaces/payroll_calculation";
import { PAYROLL_TYPE } from "@/lib/payroll/constants";
import { formatPeriodRange } from "@/lib/payroll/periodFormat";

interface Props {
  periodOptions: IPayrollProcessPage["periodOptions"];
  selectedPeriodId: number;
  selectedPayrollType: PayrollType;
  puestoOptions: IPayrollProcessPage["puestoOptions"];
  selectedPuestoId: number | null;
  searchText: string;
}

const SEARCH_DEBOUNCE_MILLISECONDS = 350;

const CONTROL_CLASSES =
  "rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all";

/** Único componente cliente de la pantalla de solo lectura: cada control reescribe los `searchParams`. */
export default function PayrollProcessToolbar({
  periodOptions,
  selectedPeriodId,
  selectedPayrollType,
  puestoOptions,
  selectedPuestoId,
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
          // Los puestos disponibles cambian con el periodo, así que el filtro de puesto se reinicia.
          onChange={(event) => replaceFilters({ periodo: event.target.value, puesto: null })}
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
          aria-label="Tipo de nómina"
          className="flex gap-1 rounded-lg bg-[#eff4ff] dark:bg-zinc-800 p-1 self-start"
        >
          {(Object.keys(PAYROLL_TYPE) as PayrollType[]).map((payrollType) => {
            const isSelected = payrollType === selectedPayrollType;
            return (
              <button
                key={payrollType}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => replaceFilters({ tipo: PAYROLL_TYPE[payrollType].urlValue, puesto: null })}
                className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                  isSelected
                    ? "bg-white dark:bg-zinc-700 text-[#0b1c30] dark:text-zinc-50 font-semibold shadow-sm"
                    : "text-[#44474f] dark:text-zinc-400 hover:text-[#0b1c30] dark:hover:text-zinc-100"
                }`}
              >
                {PAYROLL_TYPE[payrollType].label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <select
          aria-label="Puesto"
          value={selectedPuestoId ?? ""}
          onChange={(event) => replaceFilters({ puesto: event.target.value })}
          className={`${CONTROL_CLASSES} md:w-64`}
        >
          <option value="">Todos los puestos</option>
          {puestoOptions.map((puestoOption) => (
            <option key={puestoOption.id_puesto} value={puestoOption.id_puesto}>
              {puestoOption.name}
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
            aria-label="Buscar empleado"
            placeholder="Buscar por nombre o código…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className={`${CONTROL_CLASSES} w-full pl-10 bg-[#eff4ff] dark:bg-zinc-800 placeholder-[#747780] dark:placeholder-zinc-500`}
          />
        </div>
      </div>
    </div>
  );
}
