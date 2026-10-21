/** Slugs de los temas del manual de Nómina (`content/manual/nomina/`). */
export const PAYROLL_MANUAL_TOPICS = {
  basicConcepts: "conceptos-basicos",
  employeeSetup: "preparar-empleado",
  periods: "periodos",
  processPayroll: "procesar-nomina",
  employeeDetail: "detalle-empleado",
  commissions: "comisiones",
  overtime: "horas-extra",
  absences: "faltas",
  lateness: "retardos",
  bonuses: "bonos",
  profitSharing: "ptu",
  taxParameters: "parametros-fiscales",
  ordinaryPayrollTutorial: "tutorial-nomina-ordinaria",
  christmasBonusTutorial: "tutorial-aguinaldo",
  profitSharingTutorial: "tutorial-ptu",
  yearStartTutorial: "tutorial-inicio-de-anio",
  noticesAndFaq: "avisos-y-preguntas",
} as const;

/** Anclas de los `##` de `preparar-empleado.md`, una por pestaña del expediente. */
export const EMPLOYEE_SETUP_ANCHORS = {
  personalData: "datos-personales",
  attendance: "asistencia",
  schedule: "horario",
  vacations: "vacaciones",
  economicDays: "dias-economicos",
  imss: "imss",
  users: "usuarios",
} as const;

/** `buildManualHref("nomina", "periodos")` → `"/dashboard/ayuda/nomina/periodos"`. */
export function buildManualHref(moduleSlug: string, pageSlug: string, anchor?: string): string {
  const href = `/dashboard/ayuda/${moduleSlug}/${pageSlug}`;
  return anchor ? `${href}#${anchor}` : href;
}
