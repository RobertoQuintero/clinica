/**
 * Armado puro del cuerpo de `invoices.create` (tipo `N`, complemento `nomina` 1.2) para un
 * recibo de nómina fiscal (spec 98). Sin SQL, sin llamar a Facturapi: la action (paso 4) junta
 * el `PayrollCfdiSource` con el repositorio y le pasa el resultado a `getOrgClient(...).invoices.create`.
 */
import { PAYROLL_CFDI_USE, PAYROLL_RECEIVER_TAX_REGIME } from "@/lib/payroll/satCatalogs";

/** Clave SAT c_TipoPercepcion de horas extra: dispara el nodo `HorasExtra`. */
const OVERTIME_PERCEPTION_SAT_KEY = "019";
/** Serie fija de los CFDI de nómina (spec 98). */
export const PAYROLL_CFDI_SERIES = "NOM";
const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export interface PayrollCfdiPerceptionLine {
  idPerception:    number;
  claveSat:        string;
  importe:         number;
  importeGravado:  number;
  importeExento:   number;
}

/** Un día de `period_employee_overtime` de la fila. */
export interface PayrollCfdiOvertimeDay {
  fecha:           string;   // "YYYY-MM-DD"
  horasDobles:     number;
  importeDobles:   number;
  horasTriples:    number;
  importeTriples:  number;
}

export interface PayrollCfdiEmisor {
  registroPatronal: string;
  curp:             string | null;
}

export interface PayrollCfdiReceptor {
  rfc:                     string;
  curp:                    string | null;
  nss:                     string | null;
  codigoPostalFiscal:      string;
  nombreCompleto:          string;
  tipoRegimen:             string;
  tipoContrato:            string;
  tipoJornada:             string | null;
  bancoClave:              string | null;
  cuentaBancaria:          string | null;
  claveEntFed:             string;
  periodicidadPagoClaveSat: string;
  riesgoPuesto:            string;
  numEmpleado:             string;
  puesto:                  string | null;
  fechaIngreso:            string;   // "YYYY-MM-DD"
  salarioBaseCotApor:      number | null;   // solo IMSS 'C'
  salarioDiarioIntegrado:  number | null;   // solo IMSS 'C'
}

/** Todo lo que viene del snapshot congelado del periodo más la identidad leída al timbrar. */
export interface PayrollCfdiSource {
  fechaPago:        string;   // "YYYY-MM-DD"
  fechaInicialPago:  string;
  fechaFinalPago:    string;
  numDiasPagados:    number;
  emisor:            PayrollCfdiEmisor;
  receptor:          PayrollCfdiReceptor;
  perceptions:       PayrollCfdiPerceptionLine[];
  overtimeDays:      PayrollCfdiOvertimeDay[];
  imssRetenido:      number;
  isrRetenido:        number;
  subsidioConDerecho: boolean;
  subsidioCausado:    number;
}

/** Mayúsculas, espacios simples, sin recortar acentos ni Ñ (spec 98: la normalización automática no entra). */
export function normalizeReceiverName(name: string): string {
  return name.toUpperCase().trim().replace(/\s+/g, " ");
}

/**
 * Antigüedad en semanas completas entre `fechaIngreso` y `asOfDate` (el `fecha_fin` del periodo),
 * como `P{n}W`. Nunca negativa: una fecha de ingreso posterior a `asOfDate` da `P0W`.
 */
export function buildSeniorityPeriod(fechaIngreso: string, asOfDate: string): string {
  const start = new Date(`${fechaIngreso}T00:00:00`);
  const end = new Date(`${asOfDate}T00:00:00`);
  const weeks = Math.max(0, Math.floor((end.getTime() - start.getTime()) / MILLISECONDS_PER_WEEK));
  return `P${weeks}W`;
}

/** Nodos `HorasExtra` de una línea 019, uno por día y tipo, con importe > 0. `HorasExtra` va en `CEILING`. */
function buildOvertimeNodes(overtimeDays: PayrollCfdiOvertimeDay[]) {
  const nodes: { dias: number; tipo_horas: string; horas_extra: number; importe_pagado: number }[] = [];
  for (const day of overtimeDays) {
    if (day.importeDobles > 0) {
      nodes.push({ dias: 1, tipo_horas: "01", horas_extra: Math.ceil(day.horasDobles), importe_pagado: day.importeDobles });
    }
    if (day.importeTriples > 0) {
      nodes.push({ dias: 1, tipo_horas: "02", horas_extra: Math.ceil(day.horasTriples), importe_pagado: day.importeTriples });
    }
  }
  return nodes;
}

/** El cuerpo de `invoices.create`: tipo `N`, `customer` en línea, serie `NOM`, complemento `nomina`. */
export function buildPayrollCfdiPayload(source: PayrollCfdiSource): Record<string, unknown> {
  const receiverName = normalizeReceiverName(source.receptor.nombreCompleto);

  const perceptionLines = source.perceptions.filter((perception) => perception.importe > 0);

  const percepcion = perceptionLines.map((line) => ({
    tipo_percepcion: line.claveSat,
    clave: String(line.idPerception).padStart(3, "0"),
    concepto: line.claveSat,
    importe_gravado: line.importeGravado,
    importe_exento: line.importeExento,
    ...(line.claveSat === OVERTIME_PERCEPTION_SAT_KEY
      ? { horas_extra: buildOvertimeNodes(source.overtimeDays) }
      : {}),
  }));

  const deduccion: { tipo_deduccion: string; clave: string; concepto: string; importe: number }[] = [];
  if (source.imssRetenido > 0) {
    deduccion.push({ tipo_deduccion: "001", clave: "001", concepto: "Seguridad social", importe: source.imssRetenido });
  }
  if (source.isrRetenido > 0) {
    deduccion.push({ tipo_deduccion: "002", clave: "002", concepto: "ISR", importe: source.isrRetenido });
  }
  // El nodo SubsidioAlEmpleo se declara siempre en nómina ordinaria, incluso con subsidio causado
  // $0 por rebasar el tope de la tabla (`subsidioConDerecho` falso): el PAC rechaza el timbrado si
  // el OtroPago 002 no aparece.
  const otrosPagos = [{
    tipo_otro_pago: "002",
    clave: "002",
    concepto: "Subsidio para el empleo",
    importe: 0,
    subsidio_causado: source.subsidioCausado,
  }];

  return {
    type: "N",
    use: PAYROLL_CFDI_USE,
    series: PAYROLL_CFDI_SERIES,
    customer: {
      legal_name: receiverName,
      tax_id: source.receptor.rfc,
      tax_system: PAYROLL_RECEIVER_TAX_REGIME,
      address: { zip: source.receptor.codigoPostalFiscal },
    },
    complements: [{
      type: "nomina",
      data: {
        tipo_nomina: "O",
        fecha_pago: source.fechaPago,
        fecha_inicial_pago: source.fechaInicialPago,
        fecha_final_pago: source.fechaFinalPago,
        num_dias_pagados: source.numDiasPagados,
        emisor: {
          registro_patronal: source.emisor.registroPatronal,
          ...(source.emisor.curp ? { curp: source.emisor.curp } : {}),
        },
        receptor: {
          curp: source.receptor.curp ?? undefined,
          num_seguridad_social: source.receptor.nss ?? undefined,
          fecha_inicio_rel_laboral: source.receptor.fechaIngreso,
          antiguedad: buildSeniorityPeriod(source.receptor.fechaIngreso, source.fechaFinalPago),
          tipo_contrato: source.receptor.tipoContrato,
          tipo_jornada: source.receptor.tipoJornada ?? undefined,
          tipo_regimen: source.receptor.tipoRegimen,
          num_empleado: source.receptor.numEmpleado,
          puesto: source.receptor.puesto ?? undefined,
          riesgo_puesto: source.receptor.riesgoPuesto,
          periodicidad_pago: source.receptor.periodicidadPagoClaveSat,
          banco: source.receptor.bancoClave ?? undefined,
          cuenta_bancaria: source.receptor.cuentaBancaria ?? undefined,
          salario_base_cot_apor: source.receptor.salarioBaseCotApor ?? undefined,
          salario_diario_integrado: source.receptor.salarioDiarioIntegrado ?? undefined,
          clave_ent_fed: source.receptor.claveEntFed,
        },
        percepciones: {
          percepcion,
        },
        deducciones: deduccion,
        otros_pagos: otrosPagos,
      },
    }],
  };
}
