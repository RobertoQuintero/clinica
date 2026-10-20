/**
 * Esquemas zod de las acciones del reparto de PTU (spec 89). Sin `server-only`: los modales pueden
 * reutilizarlos para validar antes de enviar, pero la validación que cuenta es la de la acción.
 */
import { z } from "zod";

const MAX_MONEY_AMOUNT = 9_999_999_999_999.99;   // decimal(18,2) con margen
const MAX_DAYS_IN_YEAR = 366;

const entityId = (message: string) => z.number({ error: message }).int(message).positive(message);

/** Importe no negativo con a lo mucho dos decimales. */
const moneyAmount = (message: string) =>
  z
    .number({ error: message })
    .finite(message)
    .min(0, message)
    .max(MAX_MONEY_AMOUNT, message)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Usa a lo mucho dos decimales");

const distributionId = entityId("El reparto no es válido");
const employeeId = entityId("El empleado no es válido");

// Los literales deben coincidir con PTU_THREE_MONTHS_FACTORS; con ellos el tipo inferido es PtuThreeMonthsFactor.
const threeMonthsFactor = z.union([z.literal(90), z.literal(91.25)], {
  error: "El factor de 3 meses debe ser 90 o 91.25",
});

const taxpayerType = z.enum(["M", "F"], { error: "El tipo de persona no es válido" });

const parameterFields = {
  tipo_persona: taxpayerType,
  renta_gravable: moneyAmount("La renta gravable no es válida"),
  ptu_no_cobrada_anterior: moneyAmount("La PTU no cobrada del ejercicio anterior no es válida"),
  factor_tres_meses: threeMonthsFactor,
};

/** Alta del reparto: además de los parámetros, el ejercicio de las utilidades. */
export const createPtuDistributionSchema = z.object({
  ejercicio: z
    .number({ error: "El ejercicio no es válido" })
    .int("El ejercicio no es válido")
    .min(2000, "El ejercicio no es válido")
    .max(2100, "El ejercicio no es válido"),
  ...parameterFields,
});

/** Edición de parámetros. El ejercicio no cambia: el historial y el índice único dependen de él. */
export const updatePtuDistributionParametersSchema = z.object({
  id_ptu_distribution: distributionId,
  ...parameterFields,
});

export const ptuDistributionIdSchema = z.object({ id_ptu_distribution: distributionId });

/** Edición de las entradas de una fila: días, salario y salario diario tope. */
export const updatePtuDistributionEmployeeSchema = z.object({
  id_ptu_distribution: distributionId,
  id_empleado: employeeId,
  dias: z
    .number({ error: "Los días no son válidos" })
    .int("Los días deben ser un número entero")
    .min(0, "Los días no pueden ser negativos")
    .max(MAX_DAYS_IN_YEAR, `Los días no pueden pasar de ${MAX_DAYS_IN_YEAR}`),
  salario: moneyAmount("El salario no es válido"),
  salario_diario_tope: moneyAmount("El salario diario tope no es válido"),
});

/** Agregar y quitar un trabajador comparten la misma forma. */
export const ptuDistributionEmployeeSchema = z.object({
  id_ptu_distribution: distributionId,
  id_empleado: employeeId,
});

/** Captura manual de la PTU de un ejercicio anterior. `importe: null` borra la captura. */
export const savePtuHistorySchema = z.object({
  id_ptu_distribution: distributionId,
  id_empleado: employeeId,
  ejercicio: z
    .number({ error: "El ejercicio no es válido" })
    .int("El ejercicio no es válido")
    .min(1990, "El ejercicio no es válido")
    .max(2100, "El ejercicio no es válido"),
  importe: moneyAmount("El importe no es válido").nullable(),
});

export type CreatePtuDistributionInput = z.infer<typeof createPtuDistributionSchema>;
export type UpdatePtuDistributionParametersInput = z.infer<typeof updatePtuDistributionParametersSchema>;
export type UpdatePtuDistributionEmployeeInput = z.infer<typeof updatePtuDistributionEmployeeSchema>;
export type SavePtuHistoryInput = z.infer<typeof savePtuHistorySchema>;
