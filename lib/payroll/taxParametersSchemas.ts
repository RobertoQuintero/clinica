import { z } from "zod";
import { TAX_PARAMETER_KEYS } from "@/lib/payroll/constants";
import type { TaxParameterKey } from "@/interfaces/payroll_tax_parameters";

const TAX_PARAMETER_KEY_LIST = Object.keys(TAX_PARAMETER_KEYS) as [TaxParameterKey, ...TaxParameterKey[]];
const MAX_TAX_PARAMETER_VALUE = 99_999_999_999_999;

function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Alta o edición de un parámetro: la llave natural es (clave, vigente_desde). `valor` admite hasta 4 decimales. */
export const taxParameterSchema = z.object({
  clave: z.enum(TAX_PARAMETER_KEY_LIST, { error: "El parámetro no es válido" }),
  vigente_desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La vigencia debe tener formato AAAA-MM-DD")
    .refine(isRealCalendarDate, "La vigencia no es una fecha válida"),
  valor: z
    .number({ error: "El valor debe ser un número" })
    .positive("El valor debe ser mayor que cero")
    .max(MAX_TAX_PARAMETER_VALUE, "El valor es demasiado grande")
    .refine((value) => Math.abs(value * 10_000 - Math.round(value * 10_000)) < 1e-6, "El valor admite hasta 4 decimales"),
});

export const deleteTaxParameterSchema = z.object({
  id_tax_parameter: z.number().int().positive("Parámetro inválido"),
});

export type TaxParameterInput = z.infer<typeof taxParameterSchema>;

const MAX_BRACKET_AMOUNT = 9_999_999_999_999.99;

function twoDecimalAmount(label: string) {
  return z
    .number({ error: `${label} debe ser un número` })
    .min(0, `${label} no puede ser negativo`)
    .max(MAX_BRACKET_AMOUNT, `${label} es demasiado grande`)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, `${label} admite hasta 2 decimales`);
}

const withholdingBracketFieldsShape = {
  limite_inferior: twoDecimalAmount("El límite inferior"),
  limite_superior: twoDecimalAmount("El límite superior").nullable(),
  cuota_fija: twoDecimalAmount("La cuota fija"),
  porcentaje_excedente: z
    .number({ error: "El porcentaje debe ser un número" })
    .min(0, "El porcentaje no puede ser negativo")
    .max(100, "El porcentaje no puede ser mayor a 100")
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "El porcentaje admite hasta 2 decimales"),
};

function validateUpperLimitAboveLower(
  bracket: { limite_inferior: number; limite_superior: number | null },
  context: z.RefinementCtx,
) {
  if (bracket.limite_superior !== null && bracket.limite_superior <= bracket.limite_inferior) {
    context.addIssue({
      code: "custom",
      path: ["limite_superior"],
      message: "El límite superior debe ser mayor que el inferior",
    });
  }
}

const EXERCISE_YEAR_SCHEMA = z.number().int("El ejercicio no es válido").min(2000, "El ejercicio no es válido").max(2100, "El ejercicio no es válido");

/** Alta de un tramo de la tarifa semanal en un ejercicio. */
export const createWithholdingBracketSchema = z
  .object({ ejercicio: EXERCISE_YEAR_SCHEMA, ...withholdingBracketFieldsShape })
  .superRefine(validateUpperLimitAboveLower);

/** Edición: el ejercicio y la frecuencia no cambian; se toman de la fila existente. */
export const updateWithholdingBracketSchema = z
  .object({ id_tarifa: z.number().int().positive("Tramo inválido"), ...withholdingBracketFieldsShape })
  .superRefine(validateUpperLimitAboveLower);

export const deleteWithholdingBracketSchema = z.object({
  id_tarifa: z.number().int().positive("Tramo inválido"),
});

export const copyWithholdingTableSchema = z.object({ ejercicio_destino: EXERCISE_YEAR_SCHEMA });
