import type { ICommissionTier } from "@/interfaces/payroll_commission";

/** Tramo aplicable a un conteo, o null si ninguno lo cubre (hueco, 0 consultas, catálogo vacío). */
export function findCommissionTier(tiers: ICommissionTier[], consultationCount: number): ICommissionTier | null {
  if (consultationCount < 1) return null;
  const matchingTiers = tiers.filter(
    (tier) =>
      tier.min_consultas <= consultationCount &&
      (tier.max_consultas === null || tier.max_consultas >= consultationCount),
  );
  if (matchingTiers.length === 0) return null;
  // Igual que el SQL: ante un solapamiento gana el tramo de mayor mínimo.
  return matchingTiers.reduce((best, tier) => (tier.min_consultas > best.min_consultas ? tier : best));
}

/** Importe del tramo aplicable, o 0. Restata en TS la regla que vive en el SQL del cálculo. */
export function calculateCommissionAmount(tiers: ICommissionTier[], consultationCount: number): number {
  return findCommissionTier(tiers, consultationCount)?.importe ?? 0;
}

/** true si el rango [min, max] se traslapa con algún tramo, ignorando `excludeTierId` al editar. */
export function tierRangeOverlaps(
  tiers: ICommissionTier[],
  min: number,
  max: number | null,
  excludeTierId: number | null,
): boolean {
  const newUpperBound = max ?? Number.POSITIVE_INFINITY;
  return tiers.some((tier) => {
    if (tier.id_commission_tier === excludeTierId) return false;
    const existingUpperBound = tier.max_consultas ?? Number.POSITIVE_INFINITY;
    return min <= existingUpperBound && tier.min_consultas <= newUpperBound;
  });
}

/** "1 a 10 consultas" | "36 consultas en adelante" — etiqueta compartida por la tabla y el detalle. */
export function formatTierRange(tier: ICommissionTier): string {
  if (tier.max_consultas === null) return `${tier.min_consultas} consultas en adelante`;
  if (tier.max_consultas === tier.min_consultas) {
    return `${tier.min_consultas} ${tier.min_consultas === 1 ? "consulta" : "consultas"}`;
  }
  return `${tier.min_consultas} a ${tier.max_consultas} consultas`;
}
