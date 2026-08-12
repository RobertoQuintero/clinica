export interface IStockLevel {
  id_product:         number;
  id_sucursal:        number;
  quantity:           number;
  min_stock_effective: number | null;
}
