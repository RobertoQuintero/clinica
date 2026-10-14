import type { IVacationBadgeSummary } from "@/interfaces/vacation";

/** Fila de RH.empleados tal como la devuelven los server actions. */
export interface IEmployee {
  id_empleado:         number;
  codigo_empleado:     string;
  id_empresa:          number;
  id_sucursal:         number;

  nombre:              string;
  apellido_paterno:    string | null;
  apellido_materno:    string | null;
  foto_url:            string | null;
  fecha_ingreso:       string;          // "YYYY-MM-DD" — nunca Date
  id_supervisor:       number | null;
  whatsapp:            string | null;
  email:               string | null;
  rfc:                 string | null;
  curp:                string | null;
  nss:                 string | null;

  fecha_nacimiento:    string | null;   // "YYYY-MM-DD" — nunca Date
  genero:              string | null;
  estado_civil:        string | null;
  direccion:           string | null;
  contacto_emergencia: string | null;
  whatsapp_emergencia: string | null;
  contacto_emergencia_2: string | null;
  whatsapp_emergencia_2: string | null;

  id_department:       number;
  id_puesto:           number;
  id_turno:            number | null;
  id_periodo_pago:     number | null;
  dias_laborales:      string | null;
  horario:             string | null;
  salario_diario:      number | null;
  salario_diario_fiscal: number | null;
  tipo_salario:        string | null;
  cuenta_bancaria:     string | null;

  // Datos fiscales del receptor del CFDI de nómina (spec 71)
  codigo_postal_fiscal: string | null;
  tipo_regimen:        string | null;   // clave c_TipoRegimen
  tipo_contrato:       string | null;   // clave c_TipoContrato
  tipo_jornada:        string | null;   // clave c_TipoJornada
  sindicalizado:       boolean | null;
  banco:               string | null;   // clave c_Banco

  activo:              boolean;
  status:              boolean;
  created_at:          string | null;   // "YYYY-MM-DD HH:mm:ss"
  updated_at:          string | null;
}

/** Fila del listado: IEmployee + nombres resueltos por JOIN + nombre concatenado. */
export interface IEmployeeListItem extends IEmployee {
  /** nombre + apellido_paterno + apellido_materno, con un solo espacio entre partes no vacías. */
  nombre_completo:     string;
  nombre_departamento: string;
  nombre_puesto:       string;
  nombre_sucursal:     string;
  nombre_periodo_pago: string | null;
  /** Estatus de vacaciones del año vigente (spec 76); `null` si aún no tiene año. Solo lo llena el listado. */
  vacation?:           IVacationBadgeSummary | null;
}

/** Expediente del detalle: agrega el nombre del supervisor y del turno. */
export interface IEmployeeRecord extends IEmployeeListItem {
  nombre_supervisor:   string | null;   // concatenación de las tres columnas del supervisor
  nombre_turno:        string | null;
  nombre_banco:        string | null;   // JOIN RH.cat_bancos
  clave_estado_sat:    string | null;   // Cat_states.state_key de la sucursal; NULL si no tiene estado
}

/** Payload del modal de alta/edición. Sin campos derivados ni generados.
 *  dias_laborales / horario quedan fuera: son texto heredado de solo lectura (ver spec 59). */
export type EmployeeFormInput = Omit<
  IEmployee,
  | "id_empleado" | "codigo_empleado" | "id_empresa" | "activo" | "status" | "created_at" | "updated_at"
  | "dias_laborales" | "horario"
>;
