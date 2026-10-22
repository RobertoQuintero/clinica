import { PayrollPeriodStatus, PeriodStatusTransition } from "@/interfaces/payroll_period";

export const PERIOD_STATUS_TRANSITIONS: Record<
  PeriodStatusTransition,
  { from: PayrollPeriodStatus; to: PayrollPeriodStatus }
> = {
  approve:   { from: 2, to: 3 },
  pay:       { from: 3, to: 4 },
  unapprove: { from: 3, to: 2 },
};

/** Transiciones posibles desde un estatus. El 1 y el 4 no tienen ninguna. */
export function getAvailableStatusTransitions(status: PayrollPeriodStatus): PeriodStatusTransition[] {
  return (Object.keys(PERIOD_STATUS_TRANSITIONS) as PeriodStatusTransition[]).filter(
    (transition) => PERIOD_STATUS_TRANSITIONS[transition].from === status,
  );
}

export const UNAPPROVE_COMMENT_MIN_LENGTH = 5;
export const UNAPPROVE_COMMENT_MAX_LENGTH = 200;
