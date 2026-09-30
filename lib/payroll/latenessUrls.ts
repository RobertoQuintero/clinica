import type { LatenessClassification, LatenessStatus } from "@/interfaces/payroll_lateness";

/** Valor de `?estado=` por estado; "all" no se escribe en la URL. */
export const LATENESS_STATUS_URL_VALUES: Record<LatenessStatus, string> = {
  unjustified: "injustificado",
  justified: "justificado",
  not_applicable: "no_aplica",
};

/** Valor de `?tipo=` por clasificación; "all" no se escribe en la URL. */
export const LATENESS_CLASSIFICATION_URL_VALUES: Record<LatenessClassification, string> = {
  severe: "grave",
  accumulable: "acumulable",
};

export function readLatenessStatus(rawValue: string): "all" | LatenessStatus {
  const match = (Object.entries(LATENESS_STATUS_URL_VALUES) as [LatenessStatus, string][]).find(
    ([, urlValue]) => urlValue === rawValue,
  );
  return match ? match[0] : "all";
}

export function readLatenessClassification(rawValue: string): "all" | LatenessClassification {
  const match = (Object.entries(LATENESS_CLASSIFICATION_URL_VALUES) as [LatenessClassification, string][]).find(
    ([, urlValue]) => urlValue === rawValue,
  );
  return match ? match[0] : "all";
}
