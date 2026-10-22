// Tipos de la fase de captura del manual de Nómina (spec 93, paso 5 del plan).

export type ManualCapturePreparedState =
  | "latestCalculatedPeriod" // última semana terminada, calculada y sin avisos
  | "recalculationPending" // periodo con "Recalcula" pendiente
  | "christmasBonusCalculated"
  | "ptuDistributionClosed"
  | "none";

export interface IManualCaptureContext {
  periodIdsByState: Record<ManualCapturePreparedState, number | null>;
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
}
