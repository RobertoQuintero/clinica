export interface SatCatalogEntry {
  key: string;
  label: string;
}

/** Catálogo SAT c_TipoContrato (complemento de Nómina 1.2). */
export const SAT_CONTRACT_TYPES: ReadonlyArray<SatCatalogEntry> = [
  { key: "01", label: "Contrato de trabajo por tiempo indeterminado" },
  { key: "02", label: "Contrato de trabajo para obra determinada" },
  { key: "03", label: "Contrato de trabajo por tiempo determinado" },
  { key: "04", label: "Contrato de trabajo por temporada" },
  { key: "05", label: "Contrato de trabajo sujeto a prueba" },
  { key: "06", label: "Contrato de trabajo con capacitación inicial" },
  { key: "07", label: "Modalidad de contratación por pago de hora laborada" },
  { key: "08", label: "Modalidad de trabajo por comisión laboral" },
  { key: "09", label: "Modalidades de contratación donde no existe relación de trabajo" },
  { key: "10", label: "Jubilación, pensión, retiro" },
  { key: "99", label: "Otro contrato" },
];

/** Catálogo SAT c_TipoRegimen (complemento de Nómina 1.2). */
export const SAT_REGIME_TYPES: ReadonlyArray<SatCatalogEntry> = [
  { key: "02", label: "Sueldos" },
  { key: "03", label: "Jubilados" },
  { key: "04", label: "Pensionados" },
  { key: "05", label: "Asimilados a salarios, miembros de las sociedades cooperativas de producción" },
  { key: "06", label: "Asimilados a salarios, integrantes de sociedades y asociaciones civiles" },
  { key: "07", label: "Asimilados a salarios, miembros de consejos directivos, de vigilancia, consultivos" },
  { key: "08", label: "Asimilados a salarios, actividad empresarial (comisionistas)" },
  { key: "09", label: "Asimilados a salarios, honorarios asimilados a salarios" },
  { key: "10", label: "Asimilados a salarios, ingresos acciones o títulos valor" },
  { key: "11", label: "Asimilados a salarios, otros" },
  { key: "12", label: "Jubilados o pensionados" },
  { key: "13", label: "Indemnización o separación" },
  { key: "99", label: "Otro régimen" },
];

/** Catálogo SAT c_TipoJornada (complemento de Nómina 1.2). */
export const SAT_WORKDAY_TYPES: ReadonlyArray<SatCatalogEntry> = [
  { key: "01", label: "Diurna" },
  { key: "02", label: "Nocturna" },
  { key: "03", label: "Mixta" },
  { key: "04", label: "Por hora" },
  { key: "05", label: "Reducida" },
  { key: "06", label: "Continuada" },
  { key: "07", label: "Partida" },
  { key: "08", label: "Por turnos" },
  { key: "99", label: "Otra jornada" },
];

/**
 * Catálogo SAT c_RiesgoPuesto (complemento de Nómina 1.2). Se excluye la clave 99
 * "No aplica": con registro patronal el SAT exige una clase real (spec 72).
 */
export const SAT_JOB_RISK_CLASSES: ReadonlyArray<SatCatalogEntry> = [
  { key: "1", label: "Clase I" },
  { key: "2", label: "Clase II" },
  { key: "3", label: "Clase III" },
  { key: "4", label: "Clase IV" },
  { key: "5", label: "Clase V" },
];

/** Claves fijas del receptor en un CFDI de nómina. Las usará la spec de timbrado. */
export const PAYROLL_RECEIVER_TAX_REGIME = "605";
export const PAYROLL_CFDI_USE = "CN01";

/** Valores que se prellenan en un alta nueva (los mismos que el UPDATE de la spec 71 a los existentes). */
export const DEFAULT_EMPLOYEE_FISCAL_VALUES = {
  tipo_regimen: "02",
  tipo_contrato: "01",
  tipo_jornada: "01",
  sindicalizado: false,
};

/** Descripción "clave — etiqueta" de una entrada de catálogo, o la clave sola si no se reconoce. */
export function describeCatalogKey(
  catalog: ReadonlyArray<SatCatalogEntry>,
  key: string | null | undefined,
): string | null {
  if (!key) return null;
  const entry = catalog.find((catalogEntry) => catalogEntry.key === key);
  return entry ? `${entry.key} — ${entry.label}` : key;
}
