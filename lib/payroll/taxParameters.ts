import type { IWithholdingBracket, ITaxParameter, TaxParameterKey } from "@/interfaces/payroll_tax_parameters";

type TaxParameterRow = Pick<ITaxParameter, "clave" | "valor" | "vigente_desde">;

/**
 * Fila vigente de un parámetro: la más reciente con `vigente_desde <= effectiveDate`, o null si no hay ninguna.
 * Las fechas son "YYYY-MM-DD" (o "YYYY-MM-DD HH:mm:ss"); se comparan como texto, sin construir `Date`.
 */
export function resolveTaxParameterRow<Row extends TaxParameterRow>(
  parameters: Row[],
  key: TaxParameterKey,
  effectiveDate: string,
): Row | null {
  const effectiveDay = effectiveDate.slice(0, 10);
  let latestRow: Row | null = null;
  for (const parameter of parameters) {
    if (parameter.clave !== key || parameter.vigente_desde.slice(0, 10) > effectiveDay) continue;
    if (latestRow === null || parameter.vigente_desde > latestRow.vigente_desde) latestRow = parameter;
  }
  return latestRow;
}

/** Valor vigente de un parámetro a `effectiveDate` (la `fecha_fin` del periodo), o null sin fila vigente: sin valores por defecto. */
export function resolveTaxParameter(
  parameters: TaxParameterRow[],
  key: TaxParameterKey,
  effectiveDate: string,
): number | null {
  return resolveTaxParameterRow(parameters, key, effectiveDate)?.valor ?? null;
}

/**
 * Tramo de la tarifa al que pertenece `income`: el de mayor `limite_inferior <= income` que lo contiene.
 * Un ingreso igual a un límite inferior cae en ese tramo. Devuelve null si el ingreso queda por debajo del
 * primer tramo, en un hueco o por encima del último límite superior cuando no hay tramo abierto.
 */
export function findWithholdingBracket(
  brackets: IWithholdingBracket[],
  income: number,
): IWithholdingBracket | null {
  let matchingBracket: IWithholdingBracket | null = null;
  for (const bracket of brackets) {
    if (bracket.limite_inferior > income) continue;
    if (bracket.limite_superior !== null && income > bracket.limite_superior) continue;
    if (matchingBracket === null || bracket.limite_inferior > matchingBracket.limite_inferior) {
      matchingBracket = bracket;
    }
  }
  return matchingBracket;
}
