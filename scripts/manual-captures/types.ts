// Tipos de la fase de captura del manual de Nómina (spec 93, paso 5 del plan; spec 95 agrega
// approvedPeriod, paidPeriod y beforeCapture).
import type { Page } from "@playwright/test";

export type ManualCapturePreparedState =
  | "latestCalculatedPeriod" // última semana terminada, calculada y sin avisos
  | "recalculationPending" // periodo con "Recalcula" pendiente
  | "christmasBonusCalculated"
  | "ptuDistributionClosed"
  | "approvedPeriod" // semana vieja aprobada (estatus 3), sin avisos pendientes
  | "paidPeriod" // semana vieja aprobada, desaprobada, reaprobada y pagada (estatus 4)
  | "none";

export interface IManualCaptureContext {
  periodIdsByState: Record<ManualCapturePreparedState, number | null>;
  /** Spec 95: semana vieja calculada que nunca se aprueba, para la captura de "Aprobar" habilitado. */
  readyToApprovePeriodId: number;
  ptuDistributionId: number;
  sampleEmployeeId: number;
}

export interface IManualCaptureDefinition {
  /** = nombre del marcador `captura:<name>` en content/manual/<moduleSlug>/*.md. */
  name: string;
  moduleSlug: "nomina";
  /** Ruta de la app (sin dominio) a abrir para esta captura. */
  path: (context: IManualCaptureContext) => string;
  /** "content": recorta el área de contenido (todo menos sidebar/encabezado). Un locator recorta un elemento puntual. */
  target: "content" | { locator: string };
  preparedState: ManualCapturePreparedState;
  /** Spec 95: interacción opcional antes de la captura (p. ej. abrir un <details>). */
  beforeCapture?: (page: Page) => Promise<void>;
}
