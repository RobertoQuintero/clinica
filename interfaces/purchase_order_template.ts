export interface IPurchaseOrderTemplate {
  id_purchase_order_template: number;
  name:            string;
  id_empresa:      number;
  id_sucursal:     number | null;
  id_user_created: number;
  created_at:      string;   // "YYYY-MM-DD HH:mm:ss" (CONVERT varchar(19), 120)
  updated_at:      string;
  status:          boolean;
}

export interface IPurchaseOrderTemplateItem {
  id_purchase_order_template_item: number;
  id_purchase_order_template:      number;
  id_product:                      number;
  id_supplier:                     number | null;
  quantity:                        number;
}

/** Fila del grid: encabezado + agregados calculados server-side sobre precios actuales. */
export interface IPurchaseOrderTemplateListItem extends IPurchaseOrderTemplate {
  items_count:     number;   // solo líneas con producto activo de la empresa
  estimated_value: number;   // Σ quantity × Products.price actual, SIN IVA
}

/** Línea resuelta para el modal de edición y para cargar al carrito. */
export interface IPurchaseOrderTemplateItemDetail extends IPurchaseOrderTemplateItem {
  product_name:        string;
  product_code:        string;
  brand:               string;
  id_unit_measurement: number | null;
  pieces:              number | null;
  split:               boolean;
  price:               number;   // Products.price actual
  is_available:        boolean;  // producto existe, activo = 1, status = 1 y de la empresa
}
