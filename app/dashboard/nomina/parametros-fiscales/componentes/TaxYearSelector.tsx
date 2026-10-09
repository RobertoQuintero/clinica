import { TAX_PARAMETERS_TAB_URL_VALUES, type TaxParametersTab } from "@/lib/payroll/taxParametersUrls";

interface Props {
  selectedYear: number;
  yearOptions: number[];
  activeTab: TaxParametersTab;
}

/** Formulario GET: el ejercicio vive en la URL, sin estado de cliente ni JavaScript. */
export default function TaxYearSelector({ selectedYear, yearOptions, activeTab }: Props) {
  return (
    <form method="get" className="flex items-end gap-2">
      <input type="hidden" name="pestana" value={TAX_PARAMETERS_TAB_URL_VALUES[activeTab]} />
      <label className="flex flex-col gap-1 text-xs font-semibold text-[#44474f] dark:text-zinc-400">
        Ejercicio
        <select
          name="ejercicio"
          defaultValue={selectedYear}
          className="rounded-lg border border-[#c4c6d0] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-[#0b1c30] dark:text-zinc-100"
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003ea7] transition-colors"
      >
        Ver
      </button>
    </form>
  );
}
