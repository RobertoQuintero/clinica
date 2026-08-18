export interface ISupplierProduct {
  id_product: number;
  name: string;
  product_code: string;
  category_name: string | null;
  unit_name: string | null;
  price: number;
  last_purchase: string | null; // "YYYY-MM-DD", CONVERT(varchar(10), …, 120)
}
