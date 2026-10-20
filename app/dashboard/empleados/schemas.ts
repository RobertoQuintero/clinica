import "server-only";
import { z } from "zod";
import type { EmployeeFormInput } from "@/interfaces/employee";
import {
  SAT_CONTRACT_TYPES,
  SAT_REGIME_TYPES,
  SAT_WORKDAY_TYPES,
  type SatCatalogEntry,
} from "@/lib/payroll/satCatalogs";
import {
  getStampingIssues,
  isClabeAccount,
  normalizeBankAccount,
  normalizeTaxIdentifier,
} from "@/lib/payroll/payrollStampingReadiness";

/**
 * Validación de la entrada de createEmployee / updateEmployee (spec 71).
 * Una frontera `'use server'` acepta cualquier input deserializado; aquí se normaliza
 * y se valida antes de que algo llegue a `queryParams`.
 */

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

const nullableText = z.string().nullish().transform(trimmedOrNull);

function catalogKey(catalog: ReadonlyArray<SatCatalogEntry>, label: string) {
  const allowedKeys = catalog.map((entry) => entry.key);
  return nullableText.refine(
    (value) => value === null || allowedKeys.includes(value),
    `${label} no es una clave válida del catálogo del SAT`,
  );
}

const requiredId = (message: string) =>
  z.number({ error: message }).int(message).positive(message);

const employeeInputSchema = z
  .looseObject({
    nombre: z.string({ error: "El nombre es obligatorio" }).trim().min(1, "El nombre es obligatorio"),
    id_department: requiredId("El departamento es obligatorio"),
    id_puesto: requiredId("El puesto es obligatorio"),
    id_sucursal: requiredId("La sucursal es obligatoria"),
    fecha_ingreso: z
      .string({ error: "La fecha de ingreso es obligatoria" })
      .min(1, "La fecha de ingreso es obligatoria"),

    salario_diario_fiscal: z.number().nullish().transform((value) => value ?? null),
    id_periodo_pago: z.number().nullish().transform((value) => value ?? null),

    rfc: z.string().nullish().transform(normalizeTaxIdentifier),
    curp: z.string().nullish().transform(normalizeTaxIdentifier),
    nss: nullableText,
    codigo_postal_fiscal: nullableText,
    cuenta_bancaria: z.string().nullish().transform(normalizeBankAccount),
    banco: nullableText,

    tipo_regimen: catalogKey(SAT_REGIME_TYPES, "El tipo de régimen"),
    tipo_contrato: catalogKey(SAT_CONTRACT_TYPES, "El tipo de contrato"),
    tipo_jornada: catalogKey(SAT_WORKDAY_TYPES, "El tipo de jornada"),
    sindicalizado: z.boolean().nullish().transform((value) => value ?? null),

    categoria_ptu: z.enum(["N", "C", "X"], { error: "La categoría de PTU no es válida" }),
  })
  .superRefine((employee, context) => {
    // La sucursal sin estado no se puede resolver aquí ni debe impedir guardar.
    const issues = getStampingIssues(employee, null).filter(
      (issue) => issue.field !== "estado_sucursal",
    );
    for (const issue of issues) {
      context.addIssue({ code: "custom", path: [issue.field], message: issue.label });
    }
  })
  // El SAT prohíbe mandar `Banco` cuando la cuenta es CLABE: se guarda NULL aunque el cliente lo mande.
  .transform((employee) => ({
    ...employee,
    banco: isClabeAccount(employee.cuenta_bancaria) ? null : employee.banco,
  }));

export type EmployeeInputParseResult =
  | { ok: true; data: EmployeeFormInput }
  | { ok: false; message: string };

/** Normaliza y valida el payload del formulario. El primer error vuelve como `message`. */
export function parseEmployeeInput(input: unknown): EmployeeInputParseResult {
  const parsed = employeeInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos del empleado inválidos" };
  }
  return { ok: true, data: parsed.data as unknown as EmployeeFormInput };
}
