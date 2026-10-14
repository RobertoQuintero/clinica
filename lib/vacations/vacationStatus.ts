import type { IVacationEntitlement, VacationStatus } from "@/interfaces/vacation";

/** Campos mínimos para derivar el estatus (el listado no trae bitácora ni el snapshot completo). */
export type VacationStatusInput = Pick<
  IVacationEntitlement,
  | "dias_derecho"
  | "fecha_limite_solicitud"
  | "fecha_inicio"
  | "fecha_fin"
  | "dias_tomados"
  | "fecha_pago"
>;

/**
 * Estatus del año de derecho a partir de la fila y de la fecha de hoy (CDMX, "YYYY-MM-DD",
 * p. ej. `addZeroToday(new Date())`). Las fechas "YYYY-MM-DD" se comparan como texto.
 */
export const getVacationStatus = (
  entitlement: VacationStatusInput,
  today: string,
): VacationStatus => {
  if (entitlement.fecha_pago !== null) return "pagada";

  const { fecha_inicio, fecha_fin, dias_tomados, dias_derecho } = entitlement;
  if (fecha_inicio !== null && fecha_fin !== null) {
    if (today < fecha_inicio) return "programada";
    if (today <= fecha_fin) return "en_curso";
    return (dias_tomados ?? 0) >= dias_derecho ? "tomada" : "por_pagar";
  }

  return today <= entitlement.fecha_limite_solicitud ? "pendiente" : "por_pagar";
};

/** Días que se pagarían hoy: solo en `por_pagar`; 0 en cualquier otro estatus. */
export const getDaysToPay = (
  entitlement: VacationStatusInput,
  today: string,
): number => {
  if (getVacationStatus(entitlement, today) !== "por_pagar") return 0;
  return entitlement.dias_derecho - (entitlement.dias_tomados ?? 0);
};
