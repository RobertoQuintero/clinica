import type { PayrollPeriodStatus } from "@/interfaces/payroll_period";
import type { PayrollType } from "@/interfaces/payroll_calculation";

/** Una captura de un día pendiente, con lo que la pantalla necesita mostrar (spec 97). */
export interface IPendingDayPaymentRow {
  id_pending_day_payment: number;
  id_period:              number;
  id_empleado:            number;
  codigo_empleado:        string;
  nombre_completo:        string;
  fecha:                  string;   // "YYYY-MM-DD"
  tarifa_operativa:       number;
  tarifa_fiscal:          number;
  motivo:                 string;
  created_at:             string;   // "YYYY-MM-DD HH:mm:ss"
  capturado_por:          string;
  periodo_de_la_fecha:    string | null;   // código del periodo que contiene la fecha, si existe
  estatus_de_la_fecha:    PayrollPeriodStatus | null;
  pagado_en:              string | null;   // código del periodo que ya la pagó
  sin_salario_operativa:  boolean;
  sin_salario_fiscal:     boolean;
}

/** Un día pendiente ya pagado, como lo lee el Detalle. */
export interface IPayrollPendingDayRow {
  fecha:          string;
  tipo_nomina:    PayrollType;
  tarifa_diaria:  number;
  importe:        number;
  motivo:         string;
}
