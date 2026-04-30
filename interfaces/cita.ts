export interface ICita {
    id_cita:            number;
    id_paciente:        number;
    id_podologo:        number;
    fecha_inicio:       Date | string;
    fecha_fin:          Date | string;
    estado:             string;
    motivo_cancelacion: string;
    created_at:         Date | string;
    deleted_at:         Date | string;
    id_sucursal:        number;
    id_empresa:         number;
    google_event_id?:   string | null;
}
