export interface IPurchaseReception {
  id_reception:       number;
  id_purchase_order:  number;
  id_sucursal:        number;
  id_user:            number;
  notes:              string | null;
  is_final:           boolean;
  created_at:         Date | string;
}

/** Línea capturada en la pantalla de recepción: cantidad recibida ahora, en unidades de compra. */
export interface IReceptionLineInput {
  id_purchase_order_item: number;
  quantity_received_now:  number;
}
