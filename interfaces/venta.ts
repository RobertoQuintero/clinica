export interface IVenta {
  id_venta:            number;
  id_producto:         number;
  cantidad:            number;
  idMetodoPago:        number;
  total:               number;
  created_at:          string;
  id_usuario:          number;
  status:              number;
  webid:               string | null;
  facturado:           number | null;
  uuid_cfdi:           string | null;
  // joined
  nombre_producto?:    string;
  descripcion_metodo?: string;
}
