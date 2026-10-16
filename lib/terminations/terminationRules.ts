import type { TerminationType } from "@/interfaces/employee_termination";

export const TERMINATION_TYPE_LABELS: Record<TerminationType, string> = {
  R: "Renuncia (finiquito)",
  D: "Despido (liquidación)",
};

export const TERMINATION_NOTES_MAX_LENGTH = 500;
