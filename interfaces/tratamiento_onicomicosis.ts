export interface ITratamientoOnicomicosis {
  id_tratamiento:         number;
  id_consulta:            number;
  peso:                   string;
  talla:                  string;
  altura:                 string;
  antecedentes_cronicos:  string;
  antecedentes_hepaticos: string;
  medicacion_actual:      string;
  created_at:             string;
  id_stage:               number;
  id_usuario:             number;
  id_especialista:        number;
  new_message:            boolean;
  message:                string | null;
  id_billing_stage:       number | null;
}

export interface ITratamientoOnicomicosisListRow {
  id_tratamiento:      number;
  id_consulta:         number;
  id_stage:            number;
  created_at:          string;
  nombre_paciente:     string;
  nombre_especialista: string;
  nombre_usuario:      string;
  nombre_stage:        string;
  new_message:         boolean;
  message:             string | null;
  num_consultas:       number;
  pago_especialista:        string;
}

export interface ITratamientoPagoOnicomicosis {
  id_tratamiento_pago:      number;
  id_tratamiento:           number;
  total:                    number;
  idMetodoPago:             number;
  status:                   number;
  created_at:               string;
  facturado:                boolean;
  webid:                    string;
  uuid_cfdi:                null;
  id_usuario:               number;
  id_usuario_elimino:       null;
  deleted_date:             null;
  id_tratamiento_pago_tipo: number;
  referencia:               string;
}
