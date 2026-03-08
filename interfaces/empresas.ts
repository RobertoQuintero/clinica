export interface IEmpresa {
    id_empresa: number;
    nombre:     string;
    telefono:   string;
    email:      string;
    created_at: Date | string;
    status:     boolean;
}
