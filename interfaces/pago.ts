export interface IPago {
    id_pago:      number;
    id_consulta:  number;
    monto:        number;
    fecha_pago:   Date | string;
    referencia:   string;
    created_at:   Date | string;
    id_empresa:   number;
    idMetodoPago: number;
    webid:       string;
    facturado:    boolean;
    uuid_cfdi: string | null;
}
