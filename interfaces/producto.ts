export interface IProducto {
    id_producto: number;
    nombre:      string;
    precio:      number;
    status:      string;
    created_at:  Date | string;
    id_empresa:  number;
    descripcion: string;
    id_sucursal: number;
}
