import type { ActionResult } from "@/lib/payroll/access";

/** Lo mínimo que los modales de justificación necesitan saber de un día de Faltas o de Retardos. */
export interface IJustifiableDay {
  id_empleado:     number;
  nombre_completo: string;
  fecha:           string;   // "YYYY-MM-DD"
  status:          "unjustified" | "justified" | "not_applicable";
  comentario:      string | null;
}

/** Un dato del resumen del día en el encabezado del modal: "Día" o "Horario", "Entrada", etc. */
export interface IJustificationSummaryItem {
  label: string;
  value: string;
}

/** Server action de justificación: recibe el payload sin validar y responde con `ActionResult`. */
export type JustificationAction = (input: unknown) => Promise<ActionResult<null>>;
