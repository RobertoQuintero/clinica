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
    sucursales_string: string;
    id_empleado:   number | null;   // NULL = la cuenta no pertenece a ningún empleado
}

/** Fila del listado de /dashboard/usuarios: IUser + nombre del empleado por LEFT JOIN. */
export interface IUserListItem extends IUser {
    nombre_empleado: string | null;   // nombre + apellidos, o null si id_empleado es NULL
}

/** Fila de usuario en la pestaña "Usuarios" de la ficha. La usan las dos listas:
 *  los ya vinculados y los elegibles del buscador. */
export interface IEmployeeUserListItem {
    id_user:         number;
    nombre:          string;
    email:           string;
    id_role:         number;
    nombre_role:     string;
    id_sucursal:     number;
    nombre_sucursal: string;
    status:          boolean;
}
