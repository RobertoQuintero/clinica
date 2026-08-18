/** Redondea a 2 decimales evitando el error de coma flotante de un simple `Math.round(x*100)/100`. */
export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
