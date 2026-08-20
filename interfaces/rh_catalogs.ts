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
