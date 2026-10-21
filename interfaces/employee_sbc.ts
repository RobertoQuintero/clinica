export interface IEmployeeSbc {
  id_employee_sbc: number;
  id_empleado:     number;
  sbc:             number;
  vigente_desde:   string;   // "YYYY-MM-DD"
  updated_by_name: string;
  updated_at:      string;   // "YYYY-MM-DD HH:mm:ss"
}

export interface IEmployeeSbcLogEntry {
  id_log:          number;
  vigente_desde:   string;
  sbc_anterior:    number | null;   // null: alta
  sbc_nuevo:       number | null;   // null: baja
  updated_by_name: string;
  updated_at:      string;
}
