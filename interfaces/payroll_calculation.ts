import { IPayrollPeriodRow } from "@/interfaces/payroll_period";
import { IPayrollPaidTreatment } from "@/interfaces/payroll_treatment_commission";

export type PayrollType = "O" | "F";

// Fila de la tabla de Procesar nómina: el snapshot más los datos actuales del empleado, vía JOIN.
export interface IPayrollEmployeeRow {
  id_period_employee: number;
  id_empleado:        number;
  codigo_empleado:    string;
  nombre_completo:    string;
  id_puesto:          number;
  nombre_puesto:      string;
  tipo_nomina:        PayrollType;
  salario_diario:     number;
  dias:               number;
  importe_salario:    number;
  consultas_atendidas: number;
  importe_comision:    number;
  tratamientos_onicomicosis:     number;
  importe_comision_tratamientos: number;
  total_percepciones:  number;  // importe_salario + importe_comision + importe_comision_tratamientos, calculado en el SELECT
  calculated_at:      string;   // "YYYY-MM-DD HH:mm:ss"
}

// Empleado de la frecuencia y sucursal del periodo sin salario capturado para el tipo seleccionado.
export interface IPayrollExcludedEmployee {
  id_empleado:     number;
  codigo_empleado: string;
  nombre_completo: string;
}

export interface IPayrollProcessFilters {
  idPeriod:    number | null;   // null: periodo activo en curso, o el más reciente
  payrollType: PayrollType;     // URL: tipo=operativa|fiscal
  idPuesto:    number | null;
  search:      string;          // nombre o código, coincidencia parcial
}

export interface IPayrollProcessPage {
  period:            IPayrollPeriodRow | null;
  periodOptions:     Pick<IPayrollPeriodRow, "id_period" | "codigo" | "fecha_inicio" | "fecha_fin" | "status">[];
  rows:              IPayrollEmployeeRow[];                           // ya filtradas por puesto y búsqueda
  totals:            { employees: number; importeSalario: number; importeComision: number; importeComisionTratamientos: number; totalPercepciones: number };   // de todo el tipo, sin filtros
  puestoOptions:     { id_puesto: number; name: string }[];
  excludedEmployees: IPayrollExcludedEmployee[];
  lastCalculatedAt:  string | null;
}

// Una línea de la tarjeta "Percepciones totales": "sueldo_base" o "comision_consultas".
export interface IPayrollPerceptionLine {
  key:         string;          // identificador estable, se usa como React key: "sueldo_base"
  label:       string;          // "Sueldo base"
  description: string;          // "15 días × $333.33 diarios"
  note:        string | null;   // "Ingresó el 22/09/2026, proporcional" o null
  amount:      number;          // importe ya redondeado a 2 decimales
}

export interface IPayrollEmployeeDetailFilters {
  idEmpleado:  number;
  idPeriod:    number;          // obligatorio: sin periodo se llama a notFound()
  payrollType: PayrollType;
  idPuesto:    number | null;   // solo para Anterior / Siguiente y Regresar
  search:      string;          // ídem
}

// Fila del snapshot `payroll.period_employees` para un empleado y tipo.
export interface IPayrollEmployeeSnapshot {
  salario_diario:  number;
  dias:            number;
  importe_salario: number;
  consultas_atendidas: number;
  importe_comision:    number;
  tratamientos_onicomicosis:     number;
  importe_por_tratamiento:       number;
  importe_comision_tratamientos: number;
  calculated_at:   string;      // "YYYY-MM-DD HH:mm:ss"
}

export interface IPayrollEmployeeDetail {
  period:   IPayrollPeriodRow;
  employee: {
    id_empleado:     number;
    codigo_empleado: string;
    nombre_completo: string;
    nombre_puesto:   string;
    foto_url:        string | null;
    activo:          boolean;
    fecha_ingreso:   string;    // "YYYY-MM-DD"
  };
  // null si el empleado no está en la nómina del tipo pedido (o si el periodo sigue en estatus 1).
  snapshot:         IPayrollEmployeeSnapshot | null;
  perceptions:      IPayrollPerceptionLine[];   // [] si snapshot es null
  totalPerceptions: number;                     // suma de perceptions[].amount
  paidTreatments:   IPayrollPaidTreatment[];    // [] en fiscal o sin tratamientos pagados
  navigation: {
    previousEmployeeId: number | null;
    nextEmployeeId:     number | null;
  };
}
