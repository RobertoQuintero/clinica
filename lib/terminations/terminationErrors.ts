/** Corta una transacción con un mensaje para el usuario; el `catch` de la acción lo convierte en `ok: false`. */
export class TerminationRuleError extends Error {}

/** Violación de índice único (2601) o de restricción única (2627) de SQL Server. */
export function isUniqueViolation(error: unknown): boolean {
  const sqlErrorNumber = (error as { number?: number } | null)?.number;
  return sqlErrorNumber === 2601 || sqlErrorNumber === 2627;
}
