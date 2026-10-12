/**
 * Reglas puras del emisor del CFDI de nómina (spec 72). Sin dependencias de servidor:
 * las usan el schema zod, la sección de la pestaña General y, más adelante, la spec de timbrado.
 */
import type { PayrollIssuerInput } from "@/interfaces/organization";
import { CURP_PATTERN } from "@/lib/payroll/payrollStampingReadiness";
import { SAT_JOB_RISK_CLASSES } from "@/lib/payroll/satCatalogs";

/** Formato que emite el IMSS: 11 caracteres alfanuméricos en mayúsculas. */
export const EMPLOYER_REGISTRATION_PATTERN = /^[A-Z0-9]{11}$/;

/** Longitud del RFC de una persona física (la moral tiene 12). */
const INDIVIDUAL_TAX_ID_LENGTH = 13;

export type PayrollIssuerField = "registro_patronal" | "riesgo_puesto" | "curp_emisor";

export interface PayrollIssuerIssue {
  field: PayrollIssuerField;
  reason: "missing" | "invalid";
  label: string;   // ej. "Falta el registro patronal"
}

export type PayrollIssuerWarning = "no_certificate" | "test_mode";

const FIELD_NAMES: Record<PayrollIssuerField, string> = {
  registro_patronal: "el registro patronal",
  riesgo_puesto: "la clase de riesgo",
  curp_emisor: "la CURP del emisor",
};

const INVALID_LABELS: Record<PayrollIssuerField, string> = {
  registro_patronal: "El registro patronal debe tener 11 caracteres alfanuméricos",
  riesgo_puesto: "La clase de riesgo no es una clave válida (1 a 5)",
  curp_emisor: "La CURP del emisor no tiene un formato válido",
};

const ISSUER_FIELDS_IN_ORDER: PayrollIssuerField[] = ["registro_patronal", "riesgo_puesto", "curp_emisor"];

function isValidFormat(field: PayrollIssuerField, value: string): boolean {
  switch (field) {
    case "registro_patronal":
      return EMPLOYER_REGISTRATION_PATTERN.test(value);
    case "riesgo_puesto":
      return SAT_JOB_RISK_CLASSES.some((riskClass) => riskClass.key === value);
    case "curp_emisor":
      return CURP_PATTERN.test(value);
  }
}

/** El RFC de una persona física tiene 13 caracteres; el de una persona moral, 12. */
export function isIndividualTaxId(taxId: string | null): boolean {
  return (taxId ?? "").trim().length === INDIVIDUAL_TAX_ID_LENGTH;
}

/** Datos que se necesitan para activar la organización: la CURP solo si el emisor es persona física. */
export function getRequiredPayrollIssuerFields(taxId: string | null): PayrollIssuerField[] {
  const requiredFields: PayrollIssuerField[] = ["registro_patronal", "riesgo_puesto"];
  if (isIndividualTaxId(taxId)) requiredFields.push("curp_emisor");
  return requiredFields;
}

/**
 * Lo que impide activar la organización: obligatorios faltantes y formatos inválidos
 * (un formato inválido se reporta aunque el campo no sea obligatorio). `[]` = se puede activar.
 */
export function getPayrollIssuerIssues(
  input: PayrollIssuerInput,
  taxId: string | null,
): PayrollIssuerIssue[] {
  const requiredFields = getRequiredPayrollIssuerFields(taxId);
  const issues: PayrollIssuerIssue[] = [];

  for (const field of ISSUER_FIELDS_IN_ORDER) {
    const value = (input[field] ?? "").trim();
    if (value.length > 0) {
      if (!isValidFormat(field, value)) {
        issues.push({ field, reason: "invalid", label: INVALID_LABELS[field] });
      }
    } else if (requiredFields.includes(field)) {
      issues.push({ field, reason: "missing", label: `Falta ${FIELD_NAMES[field]}` });
    }
  }

  return issues;
}

/** Avisos que no bloquean la activación: se puede preparar la configuración antes del CSD o del modo Live. */
export function getPayrollIssuerWarnings(
  hasCertificate: boolean,
  isLive: boolean,
): PayrollIssuerWarning[] {
  const warnings: PayrollIssuerWarning[] = [];
  if (!hasCertificate) warnings.push("no_certificate");
  if (!isLive) warnings.push("test_mode");
  return warnings;
}
