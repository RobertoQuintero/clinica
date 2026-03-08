export interface IConsultaProducto {
    id_consulta_producto: number;
    id_consulta:          number;
    id_producto:          number;
    precio:               number;
    cantidad:             number;
    status:               string;
    created_at:           Date | string;
}
