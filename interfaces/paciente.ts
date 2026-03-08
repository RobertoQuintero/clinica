export interface IPaciente {
    id_paciente:                  number;
    nombre:                       string;
    telefono:                     string;
    fecha_nacimiento:             Date | string;
    direccion:                    string;
    observaciones_generales:      string;
    created_at:                   Date | string;
    updated_at:                   Date | string;
    deleted_at:                   Date | string;
    apellido_paterno:             string;
    apellido_materno:             string;
    sexo:                         string;
    whatsapp:                     string;
    ciudad_preferida:             string;
    contacto_emergencia_nombre:   string;
    contacto_emergencia_whatsapp: string;
    id_sucursal:                  number;
    id_empresa:                   number;
}
