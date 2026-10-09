// Fragmentos de SQL compartidos por las actions de la tarifa ISR (spec 69). No es un archivo "use server":
// solo exporta cadenas, que las actions interpolan dentro de su transacción.
export const BRACKET_ERROR_MARKERS = {
  weeklyFrequencyMissing: "WEEKLY_FREQUENCY_NOT_FOUND",
  invalidBracket: "BRACKET_INVALID",
  secondOpenBracket: "BRACKET_SECOND_OPEN",
  overlap: "BRACKET_OVERLAP",
  notFound: "BRACKET_NOT_FOUND",
  targetHasBrackets: "TARGET_HAS_BRACKETS",
  sourceEmpty: "SOURCE_EMPTY",
} as const;

const BRACKETS_TABLE = "[CentroPodologico].[payroll].[tablas_retencion]";

/** Declara `@weekly_id` a partir de la clave SAT `@weekly_sat_key`; falla si el catálogo no tiene la frecuencia. */
export const RESOLVE_WEEKLY_FREQUENCY_SQL = `
  DECLARE @weekly_id smallint;
  SELECT @weekly_id = id_payment_period
    FROM [CentroPodologico].[RH].[payment_periods]
   WHERE clave_sat = @weekly_sat_key;
  IF @weekly_id IS NULL
    THROW 50030, '${BRACKET_ERROR_MARKERS.weeklyFrequencyMissing}', 1;`;

/**
 * Revalida el tramo dentro de la transacción: rangos válidos, un solo tramo abierto y sin traslapes.
 * `@id_tarifa` es 0 en un alta, así ninguna fila se excluye. Los huecos no se bloquean (spec 69, decisión de opción 1).
 */
export const VALIDATE_BRACKET_SQL = `
  IF @lower < 0 OR (@upper IS NOT NULL AND @upper <= @lower) OR @fixed < 0 OR @pct < 0 OR @pct > 100
    THROW 50031, '${BRACKET_ERROR_MARKERS.invalidBracket}', 1;

  IF @upper IS NULL AND EXISTS (
    SELECT 1 FROM ${BRACKETS_TABLE} WITH (UPDLOCK, HOLDLOCK)
     WHERE ejercicio = @ejercicio AND id_payment_period = @weekly_id
       AND id_tarifa <> @id_tarifa AND limite_superior IS NULL
  )
    THROW 50032, '${BRACKET_ERROR_MARKERS.secondOpenBracket}', 1;

  IF EXISTS (
    SELECT 1 FROM ${BRACKETS_TABLE} WITH (UPDLOCK, HOLDLOCK)
     WHERE ejercicio = @ejercicio AND id_payment_period = @weekly_id
       AND id_tarifa <> @id_tarifa
       AND (@upper IS NULL OR limite_inferior <= @upper)
       AND (limite_superior IS NULL OR limite_superior >= @lower)
  )
    THROW 50033, '${BRACKET_ERROR_MARKERS.overlap}', 1;`;
