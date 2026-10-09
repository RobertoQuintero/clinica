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

const CENTS_PER_UNIT = 100;

function toCents(amount: number): number {
  return Math.round(amount * CENTS_PER_UNIT);
}

export interface IWithholdingGap {
  after: number;    // limite_superior del tramo anterior
  before: number;   // limite_inferior del siguiente tramo
}

/**
 * Huecos de la tarifa: pares de tramos consecutivos donde el siguiente no empieza un centavo después del
 * anterior. Un tramo abierto cierra la tarifa, así que después de él no se espera nada.
 */
export function findWithholdingGaps(brackets: IWithholdingBracket[]): IWithholdingGap[] {
  const sortedBrackets = [...brackets].sort((first, second) => first.limite_inferior - second.limite_inferior);
  const gaps: IWithholdingGap[] = [];
  for (let index = 1; index < sortedBrackets.length; index++) {
    const previousUpperLimit = sortedBrackets[index - 1].limite_superior;
    if (previousUpperLimit === null) continue;
    const expectedLowerLimitInCents = toCents(previousUpperLimit) + 1;
    if (toCents(sortedBrackets[index].limite_inferior) > expectedLowerLimitInCents) {
      gaps.push({ after: previousUpperLimit, before: sortedBrackets[index].limite_inferior });
    }
  }
  return gaps;
}

/** true si [lowerLimit, upperLimit] se traslapa con algún tramo; `excludedBracketId` se ignora al editar. */
export function withholdingBracketOverlaps(
  brackets: IWithholdingBracket[],
  lowerLimit: number,
  upperLimit: number | null,
  excludedBracketId: number | null,
): boolean {
  const newUpperLimitInCents = upperLimit === null ? Number.POSITIVE_INFINITY : toCents(upperLimit);
  return brackets.some((bracket) => {
    if (bracket.id_tarifa === excludedBracketId) return false;
    const existingUpperLimitInCents =
      bracket.limite_superior === null ? Number.POSITIVE_INFINITY : toCents(bracket.limite_superior);
    return toCents(lowerLimit) <= existingUpperLimitInCents && toCents(bracket.limite_inferior) <= newUpperLimitInCents;
  });
}
