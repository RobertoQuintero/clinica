/** Estados de una pre-solicitud. Constantes en código, sin tabla catálogo (ver decisiones). */
export const PURCHASE_REQUEST_STATUS = {
  PENDING:   1,
  CONFIRMED: 2,
  REJECTED:  3,
  CANCELLED: 4,
} as const;

export type PurchaseRequestStatusId =
  (typeof PURCHASE_REQUEST_STATUS)[keyof typeof PURCHASE_REQUEST_STATUS];

export interface IPurchaseRequest {
  id_purchase_request: number;
  folio:               string;
  id_empresa:          number;
  id_sucursal:         number;
  id_status_request:   PurchaseRequestStatusId;
  notes:               string | null;
  rejection_reason:    string | null;
  id_user_created:     number;
  id_user_reviewed:    number | null;
  created_at:          string;         // CONVERT(varchar(19), ..., 120)
  reviewed_at:         string | null;  // CONVERT(varchar(19), ..., 120)
  status:              boolean;
}

export interface IPurchaseRequestItem {
  id_purchase_request_item: number;
  id_purchase_request:      number;
  id_product:               number;
  product_name:             string | null;
  product_code:             string | null;
  brand:                    string | null;
  id_unit_measurement:      number | null;
  quantity:                 number;
  created_at:               string;
}

/** Fila del listado: cabecera + nombre de quien la creó + conteo de líneas. */
export interface IPurchaseRequestListItem extends IPurchaseRequest {
  created_by_name: string;
  items_count:     number;
}

export interface IPurchaseRequestDetail extends IPurchaseRequestListItem {
  items: IPurchaseRequestItem[];
}

/**
 * Producto elegible en la pre-solicitud. Deliberadamente SIN `price` ni `id_supplier`:
 * el rol 2 no debe recibir esos datos ni siquiera en el payload.
 */
export interface IRequestProduct {
  id_product:          number;
  name:                string;
  product_code:        string;
  brand:               string;
  id_category:         number | null;
  id_unit_measurement: number | null;
  current_stock:       number;
}
