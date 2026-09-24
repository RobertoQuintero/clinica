/** Una fila de la lista del detalle: las líneas pagadas de un producto, agrupadas. */
export interface IPayrollSoldProduct {
  id_producto:      number;
  nombre_producto:  string;
  piezas:           number;   // SUM(cantidad)
  bono_venta:       number;   // congelado
  importe_comision: number;   // SUM(importe_comision) de las líneas, ya redondeadas
}
