export type TaxParametersTab = "parameters" | "withholding" | "perceptions";

/** Valor de `?pestana=` por pestaña. */
export const TAX_PARAMETERS_TAB_URL_VALUES: Record<TaxParametersTab, string> = {
  parameters: "parametros",
  withholding: "tarifa",
  perceptions: "percepciones",
};

/** Sin parámetro, o con un valor desconocido, abre en Parámetros. */
export function readTaxParametersTab(rawValue: string): TaxParametersTab {
  const match = (Object.entries(TAX_PARAMETERS_TAB_URL_VALUES) as [TaxParametersTab, string][]).find(
    ([, urlValue]) => urlValue === rawValue,
  );
  return match ? match[0] : "parameters";
}

/** Años que ofrece el selector: dos atrás y uno adelante del actual, más el seleccionado si queda fuera. */
export function buildYearOptions(currentYear: number, selectedYear: number): number[] {
  const years = new Set([currentYear - 2, currentYear - 1, currentYear, currentYear + 1, selectedYear]);
  return [...years].sort((first, second) => second - first);
}
