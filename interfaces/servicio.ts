export interface IServicio {
    id_servicio: number;
    nombre:      string;
    status:      string;
    cretated_at: Date | string;
    id_empresa:  number;
}
