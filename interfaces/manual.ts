export type ManualSection = "primeros-pasos" | "pantallas" | "tutoriales" | "avisos";

export interface IManualModule {
  slug: string; // "nomina"; coincide con la carpeta de content/manual/
  title: string; // "Nómina"
  description: string;
  allowedRoleIds: readonly number[]; // nómina: PAYROLL_ALLOWED_ROLE_IDS
}

export interface IManualPageSummary {
  moduleSlug: string;
  slug: string;
  title: string;
  description: string;
  section: ManualSection;
  order: number;
  updated: string; // "YYYY-MM-DD"
}

export interface IManualPage extends IManualPageSummary {
  body: string; // Markdown sin el encabezado YAML
  previous: IManualPageSummary | null;
  next: IManualPageSummary | null;
}
