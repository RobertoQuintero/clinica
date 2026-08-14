export interface IKardexEntry {
  id_kardex:              number;
  id_product:             number;
  id_sucursal:            number;
  id_empresa:             number;
  id_movement:            number;
  quantity:               number;
  balance_after:          number;
  id_unit_measurement:    number | null;
  unit_cost:              number | null;
  id_purchase_order_item: number | null;
  id_reception:           number | null;
  id_consulta:            number | null;
  id_sucursal_counterpart: number | null;
  id_transfer:            string | null;
  notes:                  string | null;
  id_user:                number;
  created_at:             Date | string;
}
