import type { AbsenceStatus, AbsenceStatusFilter } from "@/interfaces/payroll_absence";

/** Valor de `?estado=` por filtro; "all" no se escribe en la URL. */
export const ABSENCE_STATUS_URL_VALUES: Record<AbsenceStatus, string> = {
  unjustified: "injustificada",
  justified: "justificada",
  not_applicable: "no_aplica",
};

export function readAbsenceStatus(rawValue: string): AbsenceStatusFilter {
  const match = (Object.entries(ABSENCE_STATUS_URL_VALUES) as [AbsenceStatus, string][]).find(
    ([, urlValue]) => urlValue === rawValue,
  );
  return match ? match[0] : "all";
}
