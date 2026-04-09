export interface ISucursal {
    id_sucursal: number;
    id_empresa:  number;
    nombre:      string;
    ciudad:      string | null;
    direccion:   string | null;
    telefono:    string | null;
    activo:      boolean;
    created_at:  Date | string;
    status:      boolean | number | null;
}
