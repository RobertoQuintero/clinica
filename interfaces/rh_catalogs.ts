export interface IDepartment {
  id_department: number;
  name:          string;
  id_empresa:    number | null;
  status:        boolean;
  activo:        boolean;
  description:   string | null;
}

export interface IPosition {
  id_puesto:     number;
  id_department: number | null;
  name:          string;
  status:        boolean;
  activo:        boolean;
  description:   string | null;
}

export interface IShift {
  id_turno:      number;
  description:   string;
  status:        boolean;
}

export interface IPaymentPeriod {
  id_payment_period: number;
  clave_sat:          string | null;
  description:        string;
  days:               number | null;
  status:             boolean;
}

export interface IBank {
  clave:        string;   // clave SAT c_Banco, 3 dígitos
  nombre:       string;
  razon_social: string | null;
  status:       boolean;
}
