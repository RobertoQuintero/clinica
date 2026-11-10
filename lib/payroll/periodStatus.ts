import { PayrollPeriodStatus, PeriodStatusTransition } from "@/interfaces/payroll_period";

export const PERIOD_STATUS_TRANSITIONS: Record<
  PeriodStatusTransition,
  { from: PayrollPeriodStatus; to: PayrollPeriodStatus }
> = {
  approve:   { from: 2, to: 3 },
  pay:       { from: 3, to: 4 },
  unapprove: { from: 3, to: 2 },
  reopen:    { from: 4, to: 2 },   // spec 96
};

/** Transiciones posibles desde un estatus. El 1 no tiene ninguna. */
export function getAvailableStatusTransitions(status: PayrollPeriodStatus): PeriodStatusTransition[] {
  return (Object.keys(PERIOD_STATUS_TRANSITIONS) as PeriodStatusTransition[]).filter(
    (transition) => PERIOD_STATUS_TRANSITIONS[transition].from === status,
  );
}

// Spec 96: el motivo ya no es exclusivo de Desaprobar; también lo exige Reabrir.
export const STATUS_COMMENT_MIN_LENGTH = 5;
export const STATUS_COMMENT_MAX_LENGTH = 200;

/** Mensaje del candado duro de Aprobar, compartido por la acción de servidor y el botón deshabilitado. */
export const PERIOD_NEEDS_RECALCULATION_MESSAGE =
  "Recalcula la nómina antes de aprobarla: el cálculo guardado ya no coincide con los datos actuales";

/** Mensaje del candado nuevo al pagar, compartido por la acción y por el botón deshabilitado. */
export const PERIOD_HAS_MISSING_EMPLOYEES_MESSAGE =
  "Hay empleados elegibles fuera del cálculo: desaprueba el periodo, recalcula y vuelve a aprobarlo antes de pagarlo";

/** Spec 98: candado de Reabrir, compartido por la acción y por el botón deshabilitado. */
export const PERIOD_HAS_STAMPED_RECEIPTS_MESSAGE =
  "El periodo tiene recibos timbrados; cancélalos antes de reabrir";
