import { IPayrollPeriodRow } from "@/interfaces/payroll_period";

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
  totals:            { employees: number; importeSalario: number };   // de todo el tipo, sin filtros
  puestoOptions:     { id_puesto: number; name: string }[];
  excludedEmployees: IPayrollExcludedEmployee[];
  lastCalculatedAt:  string | null;
}
