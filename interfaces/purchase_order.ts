import { IPurchaseReception } from "@/interfaces/purchase_reception";

export interface IPurchaseOrder {
  id_purchase_order: number;
  folio:              string;
  id_batch:           string | null;
  id_empresa:         number;
  id_sucursal:        number;
  id_supplier:        number;
  id_status:          number;
  subtotal:           number;
  discount:           number;
  tax:                number;
  shipping_cost:      number;
  total:              number;
  tax_rate:           number;
  estimated_date:     string | null;
  delivery_date:      string | null;
  invoice_date:       string | null;
  invoice_url:        string | null;
  invoice_number:     string | null;
  notes:              string | null;
  id_metodo_pago:     number | null;
  id_user_created:    number;
  created_at:         Date | string;
  sent_at:            Date | string | null;
  closed_at:          Date | string | null;
  status:             boolean;
}

export interface IPurchaseOrderItem {
  id_purchase_order_item: number;
  id_purchase_order:      number;
  id_product:              number;
  product_name:            string | null;
  product_code:            string | null;
  brand:                   string | null;
  id_unit_measurement:    number | null;
  conversion_factor:      number;
  quantity:                number;
  quantity_received:      number;
  unit_price:              number;
  discount:                number;
  line_total:              number;
  applies_iva:             boolean;
  tax_amount:              number;
  created_at:              Date | string;
}

export interface IPurchaseOrderDetail extends IPurchaseOrder {
  items:       IPurchaseOrderItem[];
  receptions:  IPurchaseReception[];
}
