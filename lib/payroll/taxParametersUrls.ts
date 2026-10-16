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

/** Liga a Parámetros fiscales en una pestaña y ejercicio; en la tarifa, también la frecuencia (semanal por defecto). */
export function buildTaxParametersHref(
  tab: TaxParametersTab,
  fiscalYear: number,
  frequency: WithholdingFrequency = "weekly",
): string {
  const searchParams = new URLSearchParams({
    pestana: TAX_PARAMETERS_TAB_URL_VALUES[tab],
    ejercicio: String(fiscalYear),
  });
  if (tab === "withholding") searchParams.set("frecuencia", WITHHOLDING_FREQUENCY_URL_VALUES[frequency]);
  return `/dashboard/nomina/parametros-fiscales?${searchParams.toString()}`;
}

/** Años que ofrece el selector: dos atrás y uno adelante del actual, más el seleccionado si queda fuera. */
export function buildYearOptions(currentYear: number, selectedYear: number): number[] {
  const years = new Set([currentYear - 2, currentYear - 1, currentYear, currentYear + 1, selectedYear]);
  return [...years].sort((first, second) => second - first);
}

/** Frecuencia de la tarifa ISR que muestra la pestaña "Tarifa ISR" (spec 87: semanal y mensual). */
export type WithholdingFrequency = "weekly" | "monthly";

/** Valor de `?frecuencia=` por frecuencia. */
export const WITHHOLDING_FREQUENCY_URL_VALUES: Record<WithholdingFrequency, string> = {
  weekly: "semanal",
  monthly: "mensual",
};

export const WITHHOLDING_FREQUENCY_LABELS: Record<WithholdingFrequency, string> = {
  weekly: "Semanal",
  monthly: "Mensual",
};

/** Clave SAT c_PeriodicidadPago con la que cada frecuencia se resuelve en `RH.payment_periods`. */
export const WITHHOLDING_FREQUENCY_SAT_KEYS: Record<WithholdingFrequency, "02" | "05"> = {
  weekly: "02",
  monthly: "05",
};

export const WITHHOLDING_FREQUENCIES = Object.keys(WITHHOLDING_FREQUENCY_URL_VALUES) as WithholdingFrequency[];

/** Sin parámetro, o con un valor desconocido, abre en semanal. */
export function readWithholdingFrequency(rawValue: string): WithholdingFrequency {
  return WITHHOLDING_FREQUENCIES.find((frequency) => WITHHOLDING_FREQUENCY_URL_VALUES[frequency] === rawValue) ?? "weekly";
}
