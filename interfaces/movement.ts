export interface IMovement {
  id_movement:       number;
  name:              string;
  short_name:        string;
  status:            boolean;
  activo:            boolean;
  increases_storage: boolean;
  id_empresa:        number | null;
  description:       string;
}
