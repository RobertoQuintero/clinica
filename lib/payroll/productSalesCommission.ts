/** round(quantity × saleBonus, 2): comisión de una línea vendida. Restata la regla del SQL; si divergen, manda el SQL. */
export function calculateProductSaleLineCommission(quantity: number, saleBonus: number): number {
  return Math.round((quantity * saleBonus + Number.EPSILON) * 100) / 100;
}

/** "12 piezas vendidas" / "1 pieza vendida"; cantidades con decimales se muestran sin ceros de más. */
export function describeProductSalesCommission(piecesSold: number): string {
  const roundedPieces = Math.round(piecesSold * 10000) / 10000;
  return `${roundedPieces} ${roundedPieces === 1 ? "pieza vendida" : "piezas vendidas"}`;
}
