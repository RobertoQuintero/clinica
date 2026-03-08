export interface ISucursal {
    id_sucursal: number;
    id_empresa:  number;
    nombre:      string;
    ciudad:      null;
    direccion:   null;
    telefono:    null;
    activo:      boolean;
    created_at:  Date | string;
    status:      null;
}
