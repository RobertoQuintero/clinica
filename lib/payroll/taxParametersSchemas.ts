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
