export interface ISucursal {
    id_sucursal:       number;
    id_empresa:        number;
    nombre:            string;
    ciudad:            string | null;
    direccion:         string | null;
    telefono:          string | null;
    activo:            boolean;
    created_at:        Date | string;
    status:            boolean | number | null;
    id_state:          number | null;
    estado: string | null;
}

export interface ICatState {
    id_state:    number;
    string_key:  string;
    description: string;
    state_key:   string;
    status:      number;
}
