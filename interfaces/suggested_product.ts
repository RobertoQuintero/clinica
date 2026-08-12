/** Producto candidato a pedir: catálogo + existencia actual + mínimo efectivo + sugerencia. */
export interface ISuggestedProduct {
  id_product:           number;
  name:                 string;
  id_category:          number | null;
  brand:                string;
  product_code:         string;
  id_unit_measurement:  number | null;
  price:                number;
  id_supplier:          number | null;
  pieces:               number | null;
  split:                boolean;
  current_stock:        number;
  min_stock_effective:  number | null;
  suggested_quantity:   number;
  below_minimum:        boolean;
}
