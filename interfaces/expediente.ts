export interface IExpediente {
    id_expediente:        number;
    id_paciente:          number;
    antecedentes:         string;
    alergias:             string;
    enfermedades_cronicas: string;
    created_at:           Date | string;
    updated_at:           Date | string;
}
