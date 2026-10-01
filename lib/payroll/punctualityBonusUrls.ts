import type { PunctualityBonusResult } from "@/interfaces/payroll_punctuality_bonus";

/** Valor de `?resultado=` por resultado; "all" no se escribe en la URL. */
export const PUNCTUALITY_BONUS_RESULT_URL_VALUES: Record<PunctualityBonusResult, string> = {
  keeps: "conserva",
  loses: "pierde",
  not_evaluated: "no_evaluado",
};

export function readPunctualityBonusResult(rawValue: string): "all" | PunctualityBonusResult {
  const match = (Object.entries(PUNCTUALITY_BONUS_RESULT_URL_VALUES) as [PunctualityBonusResult, string][]).find(
    ([, urlValue]) => urlValue === rawValue,
  );
  return match ? match[0] : "all";
}

/** Enlace a Retardos o Faltas con el mismo periodo y el empleado en la búsqueda, que es donde se justifica. */
export function buildIncidentScreenHref(
  screenPath: "/dashboard/nomina/retardos" | "/dashboard/nomina/faltas",
  idPeriod: number,
  employeeName: string,
): string {
  const searchParams = new URLSearchParams({ periodo: String(idPeriod), q: employeeName });
  return `${screenPath}?${searchParams.toString()}`;
}
