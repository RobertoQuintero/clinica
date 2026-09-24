// Escalas de las columnas del SQL: cantidad decimal(18,4) y bono_venta decimal(10,2).
const QUANTITY_UNITS_PER_PIECE = 10_000;
const BONUS_CENTS_PER_PESO = 100;

/**
 * round(quantity × saleBonus, 2): comisión de una línea vendida. Restata la regla del SQL; si divergen, manda el SQL.
 * Multiplica enteros (cantidad en diezmilésimos, bono en centavos) y redondea la mitad hacia arriba como el
 * ROUND de SQL sobre decimales exactos, para no arrastrar el error de los flotantes (2.5 × 33.33 = 83.32499…).
 */
export function calculateProductSaleLineCommission(quantity: number, saleBonus: number): number {
  const quantityUnits = Math.round(quantity * QUANTITY_UNITS_PER_PIECE);
  const bonusCents = Math.round(saleBonus * BONUS_CENTS_PER_PESO);
  // Cada producto queda en diezmilésimos de centavo; se divide entre 10,000 con la mitad hacia arriba.
  const commissionCents = Math.floor((quantityUnits * bonusCents + QUANTITY_UNITS_PER_PIECE / 2) / QUANTITY_UNITS_PER_PIECE);
  return commissionCents / BONUS_CENTS_PER_PESO;
}

/** "12 piezas vendidas" / "1 pieza vendida"; cantidades con decimales se muestran sin ceros de más. */
export function describeProductSalesCommission(piecesSold: number): string {
  const roundedPieces = Math.round(piecesSold * 10000) / 10000;
  return `${roundedPieces} ${roundedPieces === 1 ? "pieza vendida" : "piezas vendidas"}`;
}
