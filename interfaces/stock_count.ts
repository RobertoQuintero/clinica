export type StockCountStatus =
  | "en_captura" | "segundo_conteo" | "pendiente_revision" | "cerrado" | "cancelado";

export type StockCountType = "general" | "category";

export type StockCountDecision = "aumentar" | "disminuir" | "dejar_igual";

export interface IStockCount {
  id_stock_count:   number;
  id_sucursal:      number;
  id_empresa:       number;
  count_type:       StockCountType;
  id_category:      number | null;
  status:           StockCountStatus;
  id_user_counter:  number;
  id_user_reviewer: number | null;
  created_at:       string;          // "YYYY-MM-DD HH:mm:ss"
  counted_at:       string | null;
  closed_at:        string | null;
}

export interface IStockCountItem {
  id_stock_count_item: number;
  id_stock_count:      number;
  id_product:          number;
  system_quantity:     number;
  first_count:         number | null;
  second_count:        number | null;
  needs_second_count:  boolean;
  decision:            StockCountDecision | null;
  reviewer_notes:      string | null;
  id_kardex:           number | null;
}
