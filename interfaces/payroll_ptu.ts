/** Categoría de un empleado para el reparto de PTU (spec 89): normal, de confianza o excluido. */
export type PtuCategory = "N" | "C" | "X";
export type PtuDistributionStatus = "B" | "C";
export type PtuTaxpayerType = "M" | "F";
export type PtuThreeMonthsFactor = 90 | 91.25;
export type PtuIneligibilityReason = "excluded_category" | "eventual_under_60_days" | "no_days";
/** 'P' precargado desde los snapshots fiscales, 'M' agregado a mano. */
export type PtuEmployeeOrigin = "P" | "M";

/** Fila de payroll.ptu_distributions. Fechas como string, nunca Date. */
export interface IPtuDistribution {
  id_ptu_distribution:           number;
  id_empresa:                    number;
  ejercicio:                     number;
  tipo_persona:                  PtuTaxpayerType;
  renta_gravable:                number;
  ptu_no_cobrada_anterior:       number;
  factor_tres_meses:             PtuThreeMonthsFactor;
  estado:                        PtuDistributionStatus;
  // Derivadas
  fondo:                         number;
  mitad_dias:                    number;
  mitad_salario:                 number;
  total_dias:                    number;
  total_salario_reparto:         number;
  tope_salario_diario_confianza: number | null;
  total_repartido:               number;
  remanente_topes:               number;
  remanente_redondeo:            number;
  // Auditoría
  created_by:                    number;
  created_at:                    string;   // "YYYY-MM-DD HH:mm:ss"
  updated_at:                    string;
  cerrado_by:                    number | null;
  cerrado_at:                    string | null;
}

/** Fila de payroll.ptu_distribution_employees + nombre, código y sucursal resueltos por JOIN. */
export interface IPtuDistributionEmployee {
  id_ptu_distribution_employee:  number;
  id_ptu_distribution:           number;
  id_empleado:                   number;
  id_sucursal:                   number;
  origen:                        PtuEmployeeOrigin;
  editado:                       boolean;
  // Entradas
  dias:                          number;
  salario:                       number;
  salario_diario_tope:           number;
  // Congeladas del empleado en cada recálculo
  categoria_ptu:                 PtuCategory;
  tipo_contrato:                 string | null;
  // Derivadas
  elegible:                      boolean;
  motivo:                        PtuIneligibilityReason | null;
  salario_reparto:               number | null;
  ptu_dias:                      number | null;
  ptu_salario:                   number | null;
  ptu_bruto:                     number | null;
  tope_tres_meses:               number | null;
  promedio_tres_anios:           number | null;
  anios_promedio:                number | null;
  ptu_final:                     number;
  // Resueltos por JOIN
  codigo_empleado:               string;
  nombre_completo:               string;
  nombre_sucursal:               string;
}

/** PTU de un ejercicio anterior de un trabajador: de un reparto cerrado del sistema o capturada a mano. */
export interface IPtuHistoryEntry {
  ejercicio: number;
  importe:   number;
  origen:    "reparto" | "manual";
}

// ── Entrada y salida del cálculo puro (lib/payroll/ptuDistribution.ts) ──────────────────────────

/** Parámetros del reparto que alimentan el cálculo. */
export interface IPtuCalculationParameters {
  renta_gravable:          number;
  ptu_no_cobrada_anterior: number;
  factor_tres_meses:       PtuThreeMonthsFactor;
}

/** Entradas de un trabajador. `tipo_contrato` null se trata como '01'. */
export interface IPtuCalculationRow {
  id_empleado:         number;
  dias:                number;
  salario:             number;
  salario_diario_tope: number;
  categoria_ptu:       PtuCategory;
  tipo_contrato:       string | null;
}

/** Columnas derivadas de un trabajador. Las de reparto son null cuando no es elegible. */
export interface IPtuCalculatedRow {
  id_empleado:         number;
  elegible:            boolean;
  motivo:              PtuIneligibilityReason | null;
  salario_reparto:     number | null;
  ptu_dias:            number | null;
  ptu_salario:         number | null;
  ptu_bruto:           number | null;
  tope_tres_meses:     number | null;
  promedio_tres_anios: number | null;
  anios_promedio:      number | null;
  ptu_final:           number;
}

/** Columnas derivadas del reparto. */
export interface IPtuCalculatedTotals {
  fondo:                         number;
  mitad_dias:                    number;
  mitad_salario:                 number;
  total_dias:                    number;
  total_salario_reparto:         number;
  tope_salario_diario_confianza: number | null;
  total_repartido:               number;
  remanente_topes:               number;
  remanente_redondeo:            number;
}

export interface IPtuCalculationResult {
  totals: IPtuCalculatedTotals;
  rows:   IPtuCalculatedRow[];   // mismo orden que las filas de entrada
}

/** Promedio de la PTU de los ejercicios anteriores con dato. */
export interface IPtuHistoryAverage {
  average: number;
  years:   number;
}

// ── Bitácora y detalle del reparto ────────────────────────────────────────────────────────────

/** P parámetros, R precarga, A agregar, Q quitar, E edición de fila, H historial, C cerrar, O reabrir. */
export type PtuLogAction = "P" | "R" | "A" | "Q" | "E" | "H" | "C" | "O";

/** Fila de payroll.ptu_distribution_log + nombres resueltos por JOIN. */
export interface IPtuDistributionLogEntry {
  id_ptu_distribution_log: number;
  id_empleado:             number | null;   // null en acciones del reparto
  accion:                  PtuLogAction;
  campo:                   string | null;
  valor_anterior:          string | null;
  valor_nuevo:             string | null;
  changed_by_name:         string;
  changed_at:              string;          // "YYYY-MM-DD HH:mm:ss"
  nombre_empleado:         string | null;
}

/** Lo que muestra la pantalla del reparto: el reparto, sus trabajadores y las últimas entradas de la bitácora. */
export interface IPtuDistributionDetail {
  distribution: IPtuDistribution;
  employees:    IPtuDistributionEmployee[];
  log:          IPtuDistributionLogEntry[];
}

/** Un ejercicio anterior en el modal de historial: de un reparto cerrado, capturado a mano o sin dato. */
export interface IPtuHistoryYear {
  ejercicio:          number;
  importe:            number | null;
  origen:             "reparto" | "manual" | null;
  /** Hay un reparto cerrado de la empresa para este ejercicio: solo lectura. */
  closedDistribution: boolean;
}

/** Empleado que se puede agregar a mano a un reparto. */
export interface IPtuAddableEmployee {
  id_empleado:           number;
  id_sucursal:           number;
  categoria_ptu:         PtuCategory;
  tipo_contrato:         string | null;
  codigo_empleado:       string;
  nombre_completo:       string;
  nombre_sucursal:       string;
  fecha_ingreso:         string;   // "YYYY-MM-DD"
  salario_diario_fiscal: number | null;
}
