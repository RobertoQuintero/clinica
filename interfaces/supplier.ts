export interface ISupplier {
  id_proveedor:              number;
  id_empresa:                number;
  nombre_corto:              string;
  nombre_legal:              string;
  rfc:                       string;
  codigo_postal:             string;
  direccion:                 string;
  web:                       string;
  telefono_principal:        string;
  id_phonecode_principal:    number | null;
  telefono_secundario:       string;
  whatsapp_principal:        string;
  id_whatsappcode_principal: number | null;
  whatsapp_secundario:       string;
  email_principal:           string;
  email_secundario:          string;
  activo:                    boolean;
  status:                    boolean;
  created_at:                Date | string;
}
