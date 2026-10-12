/**
 * Reglas puras de "listo para timbrar" del receptor del CFDI de nómina (spec 71).
 * Sin dependencias de servidor: las usan el schema zod, el modal y el expediente.
 */

export const RFC_PERSONA_FISICA_PATTERN = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/;
export const CURP_PATTERN = /^[A-Z]{4}\d{6}[HMX][A-Z]{5}[A-Z0-9]\d$/;
export const NSS_PATTERN = /^\d{11}$/;
export const POSTAL_CODE_PATTERN = /^\d{5}$/;
/** 10 o 11 (cuenta), 16 (tarjeta) o 18 (CLABE) dígitos. */
export const BANK_ACCOUNT_PATTERN = /^(\d{10}|\d{11}|\d{16}|\d{18})$/;

const CLABE_LENGTH = 18;
/** Regímenes de sueldos y pensiones: exigen NSS y tipo de jornada. */
const REGIMES_REQUIRING_SOCIAL_SECURITY = ["02", "03", "04"];
const CONTRACT_TYPES_WITH_EMPLOYMENT_RELATION = ["01", "02", "03", "04", "05", "06", "07", "08"];

export type StampingField =
  | "rfc" | "curp" | "nss" | "codigo_postal_fiscal" | "tipo_regimen" | "tipo_contrato"
  | "tipo_jornada" | "id_periodo_pago" | "banco" | "cuenta_bancaria" | "estado_sucursal";

export interface StampingIssue {
  field: StampingField;
  reason: "missing" | "invalid" | "inconsistent";
  /** Texto en español para la UI, ej. "Falta el código postal fiscal". */
  label: string;
}

/** Campos del empleado que intervienen en las reglas. `EmployeeFormInput` los satisface. */
export interface StampingEmployeeInput {
  salario_diario_fiscal: number | null;
  rfc: string | null;
  curp: string | null;
  nss: string | null;
  codigo_postal_fiscal: string | null;
  tipo_regimen: string | null;
  tipo_contrato: string | null;
  tipo_jornada: string | null;
  id_periodo_pago: number | null;
  banco: string | null;
  cuenta_bancaria: string | null;
}

/** RFC y CURP: mayúsculas y sin espacios. Devuelve null si queda vacío. */
export function normalizeTaxIdentifier(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").replace(/\s+/g, "").toUpperCase();
  return normalized || null;
}

/** Cuenta bancaria: sin espacios ni guiones. Devuelve null si queda vacía. */
export function normalizeBankAccount(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").replace(/[\s-]+/g, "");
  return normalized || null;
}

function normalizeText(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export function isFiscalEmployee(employee: { salario_diario_fiscal: number | null }): boolean {
  return employee.salario_diario_fiscal !== null && employee.salario_diario_fiscal > 0;
}

/** true si el tipo de contrato y el tipo de régimen son compatibles (o falta alguno). */
export function isContractConsistentWithRegime(
  contractType: string | null,
  regimeType: string | null,
): boolean {
  if (!contractType || !regimeType) return true;
  const regimeRequiresEmployment = REGIMES_REQUIRING_SOCIAL_SECURITY.includes(regimeType);
  const contractHasEmploymentRelation = CONTRACT_TYPES_WITH_EMPLOYMENT_RELATION.includes(contractType);
  return contractHasEmploymentRelation === regimeRequiresEmployment;
}

/** Una cuenta válida que no es CLABE necesita banco; una CLABE no lo lleva. */
function bankAccountRequiresBank(bankAccount: string | null): boolean {
  return bankAccount !== null
    && BANK_ACCOUNT_PATTERN.test(bankAccount)
    && bankAccount.length !== CLABE_LENGTH;
}

/** true si la cuenta es una CLABE (18 dígitos): el banco no se manda. */
export function isClabeAccount(value: string | null | undefined): boolean {
  return normalizeBankAccount(value)?.length === CLABE_LENGTH;
}

/** Campos obligatorios para timbrar. Vacío si el empleado no es fiscal. Alimenta los asteriscos del modal. */
export function getRequiredStampingFields(employee: StampingEmployeeInput): StampingField[] {
  if (!isFiscalEmployee(employee)) return [];

  const requiredFields: StampingField[] = [
    "rfc", "curp", "codigo_postal_fiscal", "tipo_contrato", "tipo_regimen", "id_periodo_pago",
  ];

  const regimeType = normalizeText(employee.tipo_regimen);
  if (regimeType && REGIMES_REQUIRING_SOCIAL_SECURITY.includes(regimeType)) {
    requiredFields.push("nss", "tipo_jornada");
  }
  if (bankAccountRequiresBank(normalizeBankAccount(employee.cuenta_bancaria))) {
    requiredFields.push("banco");
  }
  return requiredFields;
}

const MISSING_LABELS: Record<StampingField, string> = {
  rfc: "Falta el RFC",
  curp: "Falta la CURP",
  nss: "Falta el NSS",
  codigo_postal_fiscal: "Falta el código postal fiscal",
  tipo_regimen: "Falta el tipo de régimen",
  tipo_contrato: "Falta el tipo de contrato",
  tipo_jornada: "Falta el tipo de jornada",
  id_periodo_pago: "Falta el periodo de pago",
  banco: "Falta el banco de la cuenta",
  cuenta_bancaria: "Falta la cuenta bancaria",
  estado_sucursal: "La sucursal no tiene estado",
};

const INVALID_LABELS: Partial<Record<StampingField, string>> = {
  rfc: "RFC con formato inválido",
  curp: "CURP con formato inválido",
  nss: "NSS con formato inválido (11 dígitos)",
  codigo_postal_fiscal: "Código postal fiscal con formato inválido (5 dígitos)",
  cuenta_bancaria: "Cuenta bancaria con formato inválido (10, 11, 16 o 18 dígitos)",
};

const FORMAT_PATTERNS: Partial<Record<StampingField, RegExp>> = {
  rfc: RFC_PERSONA_FISICA_PATTERN,
  curp: CURP_PATTERN,
  nss: NSS_PATTERN,
  codigo_postal_fiscal: POSTAL_CODE_PATTERN,
  cuenta_bancaria: BANK_ACCOUNT_PATTERN,
};

const FIELDS_TO_CHECK: StampingField[] = [
  "rfc", "curp", "codigo_postal_fiscal", "tipo_contrato", "tipo_regimen", "id_periodo_pago",
  "nss", "tipo_jornada", "cuenta_bancaria", "banco",
];

/**
 * Problemas pendientes para timbrar; [] = listo.
 * El formato se valida siempre que el campo traiga valor; lo faltante y la sucursal sin estado
 * solo cuentan si el empleado es fiscal.
 */
export function getStampingIssues(
  employee: StampingEmployeeInput,
  branchStateKey: string | null,
): StampingIssue[] {
  const issues: StampingIssue[] = [];
  const requiredFields = getRequiredStampingFields(employee);

  const normalizedValues: Partial<Record<StampingField, string | null>> = {
    rfc: normalizeTaxIdentifier(employee.rfc),
    curp: normalizeTaxIdentifier(employee.curp),
    nss: normalizeText(employee.nss),
    codigo_postal_fiscal: normalizeText(employee.codigo_postal_fiscal),
    cuenta_bancaria: normalizeBankAccount(employee.cuenta_bancaria),
    tipo_regimen: normalizeText(employee.tipo_regimen),
    tipo_contrato: normalizeText(employee.tipo_contrato),
    tipo_jornada: normalizeText(employee.tipo_jornada),
    banco: normalizeText(employee.banco),
    id_periodo_pago: employee.id_periodo_pago ? String(employee.id_periodo_pago) : null,
  };

  for (const field of FIELDS_TO_CHECK) {
    const value = normalizedValues[field] ?? null;
    if (value === null) {
      if (requiredFields.includes(field)) {
        issues.push({ field, reason: "missing", label: MISSING_LABELS[field] });
      }
      continue;
    }
    const pattern = FORMAT_PATTERNS[field];
    if (pattern && !pattern.test(value)) {
      issues.push({ field, reason: "invalid", label: INVALID_LABELS[field] ?? MISSING_LABELS[field] });
    }
  }

  if (!isContractConsistentWithRegime(normalizedValues.tipo_contrato ?? null, normalizedValues.tipo_regimen ?? null)) {
    issues.push({
      field: "tipo_contrato",
      reason: "inconsistent",
      label: "El tipo de contrato no corresponde con el tipo de régimen",
    });
  }

  if (isFiscalEmployee(employee) && !normalizeText(branchStateKey)) {
    issues.push({ field: "estado_sucursal", reason: "missing", label: MISSING_LABELS.estado_sucursal });
  }

  return issues;
}
