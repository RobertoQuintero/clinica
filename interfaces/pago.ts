export interface IPago {
    id_pago:     number;
    id_consulta: number;
    monto:       number;
    metodo_pago: string;
    fecha_pago:  Date | string;
    referencia:  string;
    created_at:  Date | string;
    id_empresa:  number;
}
