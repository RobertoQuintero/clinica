export interface IOrderStatus {
  id_status:   number;
  name:        string;
  id_empresa:  number | null;
  status:      boolean;
  activo:      boolean;
  description: string;
}
