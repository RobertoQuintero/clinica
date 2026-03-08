export interface IUser {
    id_user:       number;
    nombre:        string;
    email:         string;
    telefono:      string;
    password_hash: string;
    id_role:       number;
    status:        boolean;
    created_at:    Date | string;
    updated_at:    Date | string;
    deleted_at:    Date | string;
    id_sucursal:   number;
    id_empresa:    number;
}
