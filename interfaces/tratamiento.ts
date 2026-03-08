export interface ITratamiento {
    id_tratamiento:     number;
    id_paciente:        number;
    descripcion:        string;
    total_sesiones:     number;
    sesiones_realizadas: number;
    estado:             string;
    created_at:         Date | string;
    deleted_at:         Date | string;
    status:             string;
}
