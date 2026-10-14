import type { IVacationEntitlementView, VacationLogAction, VacationStatus } from "@/interfaces/vacation";

/** "YYYY-MM-DD…" → "DD/MM/YYYY" recortando el string (sin Date). */
export const formatIsoDateForDisplay = (isoDate: string | null): string => {
  if (!isoDate) return "—";
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

/** "YYYY-MM-DD HH:mm:ss" → "DD/MM/YYYY HH:mm". */
export const formatDateTimeForDisplay = (dateTime: string): string => {
  const [datePart, timePart = ""] = dateTime.split(" ");
  return `${formatIsoDateForDisplay(datePart)} ${timePart.slice(0, 5)}`.trim();
};

const pluralizeDays = (days: number): string => `${days} ${days === 1 ? "día" : "días"}`;

type VacationLabelInput = Pick<
  IVacationEntitlementView,
  "status" | "dias_por_pagar" | "dias_tomados" | "dias_pagados"
>;

/** Texto del chip de estatus: "Por pagar 4 días", "Tomada 8 · Pagada 4", etc. */
export const getVacationStatusLabel = (entitlement: VacationLabelInput): string => {
  switch (entitlement.status) {
    case "pendiente":
      return "Pendiente";
    case "programada":
      return "Programada";
    case "en_curso":
      return "En curso";
    case "tomada":
      return "Tomada";
    case "por_pagar":
      return `Por pagar ${pluralizeDays(entitlement.dias_por_pagar)}`;
    case "pagada":
      return entitlement.dias_tomados
        ? `Tomada ${entitlement.dias_tomados} · Pagada ${entitlement.dias_pagados ?? 0}`
        : `Pagada ${pluralizeDays(entitlement.dias_pagados ?? 0)}`;
  }
};

export const VACATION_LOG_ACTION_LABELS: Record<VacationLogAction, string> = {
  C: "Captura",
  R: "Reprogramación",
  X: "Cancelación",
  P: "Pago de días",
  V: "Reversión de pago",
};

export type { VacationStatus };
