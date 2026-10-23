// Las 19 definiciones de captura del manual de Nómina (spec 93, paso 5 del plan; spec 95 agrega
// las tres últimas, del ciclo de aprobar/pagar). `name` debe coincidir exactamente con el
// marcador `captura:<name>` de content/manual/nomina/*.md.
import type { IManualCaptureContext, IManualCaptureDefinition } from "./types";

const periodQuery = (context: IManualCaptureContext, state: keyof IManualCaptureContext["periodIdsByState"]) => {
  const id = context.periodIdsByState[state];
  if (id === null) throw new Error(`No hay periodo preparado para el estado "${state}"`);
  return `?periodo=${id}`;
};

export const NOMINA_MANUAL_CAPTURES: readonly IManualCaptureDefinition[] = [
  {
    name: "periodos-listado",
    moduleSlug: "nomina",
    path: () => "/dashboard/nomina/periodos",
    target: "content",
    preparedState: "none",
  },
  {
    name: "procesar-nomina-tabla",
    moduleSlug: "nomina",
    path: (context) => `/dashboard/nomina/procesar${periodQuery(context, "latestCalculatedPeriod")}`,
    target: "content",
    preparedState: "latestCalculatedPeriod",
  },
  {
    name: "detalle-empleado-percepciones",
    moduleSlug: "nomina",
    path: (context) =>
      `/dashboard/nomina/procesar/${context.sampleEmployeeId}${periodQuery(context, "latestCalculatedPeriod")}`,
    target: "content",
    preparedState: "latestCalculatedPeriod",
  },
  {
    name: "comisiones-tiers",
    moduleSlug: "nomina",
    path: () => "/dashboard/nomina/comisiones",
    target: "content",
    preparedState: "none",
  },
  {
    name: "horas-extra-tabla",
    moduleSlug: "nomina",
    path: (context) => `/dashboard/nomina/horas-extra${periodQuery(context, "latestCalculatedPeriod")}`,
    target: "content",
    preparedState: "latestCalculatedPeriod",
  },
  {
    name: "faltas-tabla",
    moduleSlug: "nomina",
    path: (context) => `/dashboard/nomina/faltas${periodQuery(context, "latestCalculatedPeriod")}`,
    target: "content",
    preparedState: "latestCalculatedPeriod",
  },
  {
    name: "retardos-tabla",
    moduleSlug: "nomina",
    path: (context) => `/dashboard/nomina/retardos${periodQuery(context, "latestCalculatedPeriod")}`,
    target: "content",
    preparedState: "latestCalculatedPeriod",
  },
  {
    name: "bonos-tabs",
    moduleSlug: "nomina",
    path: (context) => `/dashboard/nomina/bonos${periodQuery(context, "latestCalculatedPeriod")}`,
    target: "content",
    preparedState: "latestCalculatedPeriod",
  },
  {
    name: "parametros-fiscales-tabla",
    moduleSlug: "nomina",
    path: () => "/dashboard/nomina/parametros-fiscales",
    target: "content",
    preparedState: "none",
  },
  {
    name: "ptu-reparto-tabla",
    moduleSlug: "nomina",
    path: (context) => `/dashboard/nomina/ptu/${context.ptuDistributionId}`,
    target: "content",
    preparedState: "ptuDistributionClosed",
  },
  {
    name: "preparar-empleado-datos-personales",
    moduleSlug: "nomina",
    path: (context) => `/dashboard/empleados/${context.sampleEmployeeId}`,
    target: { locator: '[data-manual-capture="employee-general-info"]' },
    preparedState: "none",
  },
  {
    name: "aviso-recalcula",
    moduleSlug: "nomina",
    path: (context) => `/dashboard/nomina/procesar${periodQuery(context, "recalculationPending")}`,
    target: { locator: '[aria-label="Nómina sin recalcular"]' },
    preparedState: "recalculationPending",
  },
  {
    name: "tutorial-aguinaldo-paso-1",
    moduleSlug: "nomina",
    path: (context) => `/dashboard/nomina/procesar${periodQuery(context, "christmasBonusCalculated")}`,
    target: "content",
    preparedState: "christmasBonusCalculated",
  },
  {
    name: "tutorial-inicio-anio-paso-1",
    moduleSlug: "nomina",
    path: () => "/dashboard/nomina/parametros-fiscales",
    target: "content",
    preparedState: "none",
  },
  {
    name: "tutorial-nomina-paso-1",
    moduleSlug: "nomina",
    path: (context) => `/dashboard/nomina/procesar${periodQuery(context, "latestCalculatedPeriod")}`,
    target: "content",
    preparedState: "latestCalculatedPeriod",
  },
  {
    name: "tutorial-ptu-paso-1",
    moduleSlug: "nomina",
    path: (context) => `/dashboard/nomina/ptu/${context.ptuDistributionId}`,
    target: "content",
    preparedState: "ptuDistributionClosed",
  },
  {
    // Spec 95: semana vieja calculada que nunca se aprueba, para mostrar Recalcular/Revertir/Aprobar habilitados.
    name: "procesar-nomina-aprobar",
    moduleSlug: "nomina",
    path: (context) => `/dashboard/nomina/procesar?periodo=${context.readyToApprovePeriodId}`,
    target: { locator: '[data-manual-capture="payroll-period-header"]' },
    preparedState: "none",
  },
  {
    name: "procesar-nomina-sello",
    moduleSlug: "nomina",
    path: (context) => `/dashboard/nomina/procesar${periodQuery(context, "paidPeriod")}`,
    target: { locator: '[data-manual-capture="payroll-period-header"]' },
    preparedState: "paidPeriod",
  },
  {
    name: "procesar-nomina-historial",
    moduleSlug: "nomina",
    path: (context) => `/dashboard/nomina/procesar${periodQuery(context, "paidPeriod")}`,
    target: { locator: '[data-manual-capture="payroll-status-log"]' },
    preparedState: "paidPeriod",
    beforeCapture: async (page) => {
      await page.locator('[data-manual-capture="payroll-status-log"] summary').click();
    },
  },
];
