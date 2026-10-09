import type { ExemptionPeriodicity, IPerception, TaxParameterKey } from "@/interfaces/payroll_tax_parameters";
import { TAX_PARAMETER_KEYS } from "@/lib/payroll/constants";

const PERIODICITY_LABELS: Record<ExemptionPeriodicity, string> = {
  D: "por día",
  S: "por semana",
  M: "por mes",
  A: "por año",
  E: "por evento",
};

/** "50% con tope de 5 UMA por semana": descripción legible del tope de exención de una percepción. */
export function formatExemptionLimit(perception: IPerception): string {
  const { tipo_limite_exencion: limitType, umas_limite: umas, porcentaje_exento: percentage } = perception;
  const periodLabel = perception.periodicidad_limite ? PERIODICITY_LABELS[perception.periodicidad_limite] : "";
  switch (limitType) {
    case "T":
      return "Totalmente exenta";
    case "U":
      return `Hasta ${umas} UMA ${periodLabel}`;
    case "P":
      return `${percentage}% del importe`;
    case "M":
      return `${percentage}% con tope de ${umas} UMA ${periodLabel}`;
    default:
      return "Sin exención";
  }
}

/** Valor de un parámetro con su unidad: "$108.57 por día" o "365 días". */
export function formatTaxParameterValue(key: TaxParameterKey, value: number): string {
  const unit = TAX_PARAMETER_KEYS[key].unit;
  const formatted = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 4 }).format(value);
  return unit.startsWith("$") ? `$${formatted} ${unit.slice(2)}` : `${formatted} ${unit}`;
}
