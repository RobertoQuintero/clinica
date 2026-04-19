export interface IConsulta {
    id_consulta:          number;
    id_paciente:          number;
    id_podologo:          number;
    fecha:                Date | string;
    diagnostico:          string;
    tratamiento_aplicado: string;
    observaciones:        string;
    created_at:           Date | string;
    deleted_at:           Date | string;
    costo_total:          number;
    id_sucursal:          number;
    id_empresa:           number;
    nombre_podologo?:     string;
}
