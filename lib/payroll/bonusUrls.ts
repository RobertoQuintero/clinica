import type { BonusKind, BonusResult } from "@/interfaces/payroll_bonus";

/** Valor de `?resultado=` por resultado; "all" no se escribe en la URL. Igual en los dos bonos. */
export const BONUS_RESULT_URL_VALUES: Record<BonusResult, string> = {
  keeps: "conserva",
  loses: "pierde",
  not_evaluated: "no_evaluado",
};

export function readBonusResult(rawValue: string): "all" | BonusResult {
  const match = (Object.entries(BONUS_RESULT_URL_VALUES) as [BonusResult, string][]).find(
    ([, urlValue]) => urlValue === rawValue,
  );
  return match ? match[0] : "all";
}

/** Valor de `?bono=` por bono. */
export const BONUS_KIND_URL_VALUES: Record<BonusKind, string> = {
  punctuality: "puntualidad",
  attendance: "asistencia",
};

/** Sin parámetro, o con un valor desconocido, abre en puntualidad para que los enlaces existentes sigan funcionando. */
export function readBonusKind(rawValue: string): BonusKind {
  const match = (Object.entries(BONUS_KIND_URL_VALUES) as [BonusKind, string][]).find(
    ([, urlValue]) => urlValue === rawValue,
  );
  return match ? match[0] : "punctuality";
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
