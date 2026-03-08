export interface ILoginPayload {
  email: string;
  password: string;
}

export interface IRegisterPayload {
  nombre:   string;
  email:    string;
  password: string;
  telefono: string;
}

/** Payload que vive dentro del JWT y se expone al cliente (sin password_hash) */
export interface IAuthUser {
  id_user:     number;
  nombre:      string;
  email:       string;
  id_role:     number;
  status:      boolean;
  id_sucursal: number;
  id_empresa:  number;
}

export interface IAuthContext {
  user:      IAuthUser | null;
  isLoading: boolean;
  login:  (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
