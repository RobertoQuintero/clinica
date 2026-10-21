import type { IManualModule, ManualSection } from "@/interfaces/manual";
import { PAYROLL_ALLOWED_ROLE_IDS } from "@/lib/payroll/constants";

/**
 * Sin imports de servidor: `proxy.ts` (middleware) importa este archivo, y un import
 * de servidor (o de `lucide-react`, ver `manualModuleIcons.ts`) lo metería a ese bundle.
 */
export const MANUAL_MODULES: readonly IManualModule[] = [
  {
    slug: "nomina",
    title: "Nómina",
    description: "Periodos, cálculo, incidencias, bonos, aguinaldo, PTU e impuestos.",
    allowedRoleIds: PAYROLL_ALLOWED_ROLE_IDS,
  },
];

export const MANUAL_SECTION_LABELS: Record<ManualSection, string> = {
  "primeros-pasos": "Primeros pasos",
  pantallas: "Pantallas",
  tutoriales: "Tutoriales",
  avisos: "Avisos y preguntas frecuentes",
};

export const MANUAL_SECTION_ORDER: readonly ManualSection[] = [
  "primeros-pasos",
  "pantallas",
  "tutoriales",
  "avisos",
];

export const MANUAL_CALLOUT_LABELS = { NOTE: "Nota", TIP: "Consejo", WARNING: "Atención" } as const;

/** Unión de `allowedRoleIds` de todos los manuales registrados; hoy `[1, 4]`. */
export const MANUAL_VISIBLE_ROLE_IDS: readonly number[] = Array.from(
  new Set(MANUAL_MODULES.flatMap((module) => module.allowedRoleIds))
);

export function getVisibleManualModules(roleId: number): readonly IManualModule[] {
  return MANUAL_MODULES.filter((module) => module.allowedRoleIds.includes(roleId));
}

export function canViewManualModule(roleId: number, moduleSlug: string): boolean {
  return MANUAL_MODULES.some(
    (module) => module.slug === moduleSlug && module.allowedRoleIds.includes(roleId)
  );
}
