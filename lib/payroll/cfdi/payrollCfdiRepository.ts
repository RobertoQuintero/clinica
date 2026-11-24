import "server-only";

/**
 * Toda la superficie SQL del timbrado de CFDI de nómina (spec 98). `server-only`: la UI
 * nunca importa este módulo directamente, solo las server actions de
 * `app/dashboard/nomina/procesar/actions.ts`.
 */
import { ITransactionClient } from "@/database/connection";
import db from "@/database/connection";
import { buildDate } from "@/utils/date_helpper";
import { EMPLOYEE_FULL_NAME_SQL } from "@/lib/payroll/employeeName";
import { getOrganizationByUid, getPayrollIssuerUid, writeAuditEntry } from "@/lib/billing/organizationsRepository";
import { getRootClient } from "@/lib/billing/facturapiClient";
import type { StampingEmployeeInput } from "@/lib/payroll/payrollStampingReadiness";
import { getPayrollStampingBlockReasons } from "@/lib/payroll/cfdi/payrollStampingBlockers";
import type {
  PayrollCfdiOvertimeDay,
  PayrollCfdiPerceptionLine,
  PayrollCfdiSource,
} from "@/lib/payroll/cfdi/payrollCfdiPayload";
import type {
  IPayrollCfdiReceipt,
  PayrollCfdiCancelledReceipt,
  PayrollCfdiCancellationMotive,
  PayrollCfdiRowState,
  PayrollCfdiStatus,
  PayrollIssuerSummary,
} from "@/interfaces/payroll_cfdi";
import type { PayrollPeriodStatus, PayrollPeriodType } from "@/interfaces/payroll_period";

const SCHEMA_TABLE_CFDI = "[CentroPodologico].[payroll].[period_employee_cfdi]";
const SCHEMA_TABLE_PERIOD_EMPLOYEES = "[CentroPodologico].[payroll].[period_employees]";


/**
 * Spec 99: limpieza explícita antes de cada `DELETE FROM period_employees` de `procesar/actions.ts`
 * (cuatro lugares). Esos batches ya borran `period_employees` con `DELETE ... WHERE id_period = @id_period`
 * dentro de su propio `BEGIN TRAN`, así que esta línea se interpola en el mismo batch, antes de esa
 * instrucción -- no es una llamada aparte, para que corra en la misma transacción. Preserva los recibos
 * ya cancelados (`'C'`), que sobreviven gracias a `ON DELETE SET NULL`. Primero protege los Live
 * pendientes, vigentes y los errores históricos sin revisar; los demás conservan el comportamiento actual.
 */
export const DELETE_NON_CANCELLED_PERIOD_RECEIPTS_SQL = `
       IF EXISTS (SELECT 1 FROM ${SCHEMA_TABLE_CFDI}
                   WHERE [id_period] = @id_period AND [livemode] = 1
                     AND ([estado] IN ('P','T','X') OR ([estado] = 'E' AND [external_id] IS NULL)))
         THROW 50006, 'PERIOD_HAS_STAMPED_RECEIPTS', 1;
       DELETE FROM ${SCHEMA_TABLE_CFDI} WHERE [id_period] = @id_period AND [estado] <> 'C';`;

const RECEIPT_SELECT_COLUMNS = `
  [id_period_employee_cfdi], cfdi.[id_period_employee], cfdi.[id_period], cfdi.[id_empleado],
  [livemode], [estado], [org_uid], [external_id], [intento_timbrado],
  [facturapi_id], [uuid], [serie], [folio], CAST([total] AS float) AS total,
  CONVERT(varchar(19), [fecha_timbrado], 120) AS fecha_timbrado,
  [mensaje_error], [stamped_by],
  [motivo_cancelacion],
  CONVERT(varchar(19), [cancelacion_solicitada_at], 120) AS cancelacion_solicitada_at,
  CONVERT(varchar(19), [fecha_cancelacion], 120) AS fecha_cancelacion,
  [cancelled_by],
  CONVERT(varchar(19), [created_at], 120) AS created_at,
  CONVERT(varchar(19), [updated_at], 120) AS updated_at
`;

function normalizeReceiptRow(row: Record<string, unknown>): IPayrollCfdiReceipt {
  return {
    ...(row as unknown as IPayrollCfdiReceipt),
    livemode: Boolean(row.livemode),
    total: row.total === null ? null : Number(row.total),
  };
}

// ---------------------------------------------------------------------------
// Snapshot fiscal + identidad + emisor, para validar y armar el CFDI
// ---------------------------------------------------------------------------

/** Lo que necesitan `getPayrollStampingBlockReasons` y `buildPayrollCfdiPayload` de una fila. */
export interface PayrollStampingSourceRecord {
  idPeriodEmployee:  number;
  idPeriod:          number;
  idEmpleado:        number;
  idSucursal:        number;
  periodType:        PayrollPeriodType;
  periodStatus:      PayrollPeriodStatus;
  fechaPago:         string;   // "YYYY-MM-DD"
  fechaInicio:       string;
  fechaFin:          string;
  periodicidadClaveSat: string | null;
  numDiasPagados:    number;
  employee:          StampingEmployeeInput;
  branchStateKey:    string | null;
  codigoEmpleado:    string;
  nombreCompleto:    string;
  puesto:            string | null;
  fechaIngreso:       string;
  isrEstado:         string | null;
  imssEstado:        string | null;
  isrRetenido:       number;
  imssRetenido:      number;
  subsidioConDerecho: boolean;
  subsidioCausado:    number;
  sbc:                number | null;   // solo IMSS 'C'
  hasUncalculatedExemption: boolean;
  perceptions:        PayrollCfdiPerceptionLine[];
  overtimeDays:       PayrollCfdiOvertimeDay[];
  payrollIssuerUid:   string | null;
  issuerRegistroPatronal: string | null;
  issuerCurp:         string | null;
  issuerRiesgoPuesto: string | null;
}

/**
 * Arma el snapshot fiscal completo de una fila `tipo_nomina = 'F'`: la identidad del empleado
 * se lee de `RH.empleados` al momento de llamar (no del snapshot), como pide la spec. `null`
 * si la fila no existe, no es fiscal, o no pertenece a la empresa.
 */
export async function loadPayrollStampingSource(
  idPeriodEmployee: number,
  idEmpresa: number
): Promise<PayrollStampingSourceRecord | null> {
  const rows = await db.queryParams(
    `SELECT pe.id_period_employee, pe.id_period, pe.id_empleado, pe.dias AS num_dias_pagados,
            pe.isr_estado, CAST(pe.isr_retenido AS float) AS isr_retenido,
            pe.imss_estado, CAST(pe.imss_retenido AS float) AS imss_retenido,
            pe.subsidio_con_derecho, CAST(pe.subsidio_causado AS float) AS subsidio_causado,
            p.id_sucursal, p.tipo_periodo, p.status AS period_status,
            CONVERT(varchar(10), p.fecha_pago, 120)   AS fecha_pago,
            CONVERT(varchar(10), p.fecha_inicio, 120) AS fecha_inicio,
            CONVERT(varchar(10), p.fecha_fin, 120)    AS fecha_fin,
            pp.clave_sat AS periodicidad_clave_sat,
            e.codigo_empleado, ${EMPLOYEE_FULL_NAME_SQL} AS nombre_completo,
            e.rfc, e.curp, e.nss, e.salario_diario_fiscal, e.id_periodo_pago,
            e.codigo_postal_fiscal, e.tipo_regimen, e.tipo_contrato, e.tipo_jornada,
            e.banco, e.cuenta_bancaria,
            CONVERT(varchar(10), e.fecha_ingreso, 120) AS fecha_ingreso,
            pu.name AS puesto,
            st.state_key AS clave_estado_sat,
            imss.sbc AS sbc,
            CASE WHEN EXISTS (
                   SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_perceptions] uncalc
                    WHERE uncalc.id_period_employee = pe.id_period_employee AND uncalc.exencion_estado = 'N'
                 ) THEN 1 ELSE 0 END AS has_uncalculated_exemption
       FROM ${SCHEMA_TABLE_PERIOD_EMPLOYEES} pe
       JOIN [CentroPodologico].[payroll].[periods] p ON p.id_period = pe.id_period
       JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = pe.id_empleado
       JOIN [CentroPodologico].[RH].[puestos] pu ON pu.id_puesto = e.id_puesto
       JOIN [CentroPodologico].[dbo].[sucursales] s ON s.id_sucursal = e.id_sucursal
       LEFT JOIN [CentroPodologico].[dbo].[Cat_states] st ON st.id_state = s.id_state
       LEFT JOIN [CentroPodologico].[RH].[payment_periods] pp ON pp.id_payment_period = p.id_payment_period
       LEFT JOIN [CentroPodologico].[payroll].[period_employee_imss] imss
              ON imss.id_period_employee = pe.id_period_employee
      WHERE pe.id_period_employee = @id_period_employee
        AND pe.tipo_nomina = 'F'
        AND e.id_empresa = @id_empresa`,
    { id_period_employee: idPeriodEmployee, id_empresa: idEmpresa }
  );
  const row = rows[0];
  if (!row) return null;

  const [perceptions, overtimeDays, payrollIssuerUid] = await Promise.all([
    loadPayrollCfdiPerceptions(idPeriodEmployee),
    loadPayrollCfdiOvertimeDays(idPeriodEmployee),
    getPayrollIssuerUid(db, idEmpresa),
  ]);

  const issuer = payrollIssuerUid ? await getOrganizationByUid(db, payrollIssuerUid, idEmpresa) : null;

  const employee: StampingEmployeeInput = {
    salario_diario_fiscal: row.salario_diario_fiscal === null ? null : Number(row.salario_diario_fiscal),
    rfc: row.rfc as string | null,
    curp: row.curp as string | null,
    nss: row.nss as string | null,
    codigo_postal_fiscal: row.codigo_postal_fiscal as string | null,
    tipo_regimen: row.tipo_regimen as string | null,
    tipo_contrato: row.tipo_contrato as string | null,
    tipo_jornada: row.tipo_jornada as string | null,
    id_periodo_pago: row.id_periodo_pago === null ? null : Number(row.id_periodo_pago),
    banco: row.banco as string | null,
    cuenta_bancaria: row.cuenta_bancaria as string | null,
  };

  return {
    idPeriodEmployee: Number(row.id_period_employee),
    idPeriod: Number(row.id_period),
    idEmpleado: Number(row.id_empleado),
    idSucursal: Number(row.id_sucursal),
    periodType: row.tipo_periodo as PayrollPeriodType,
    periodStatus: Number(row.period_status) as PayrollPeriodStatus,
    fechaPago: row.fecha_pago as string,
    fechaInicio: row.fecha_inicio as string,
    fechaFin: row.fecha_fin as string,
    periodicidadClaveSat: (row.periodicidad_clave_sat as string | null) ?? null,
    numDiasPagados: Number(row.num_dias_pagados),
    employee,
    branchStateKey: (row.clave_estado_sat as string | null) ?? null,
    codigoEmpleado: row.codigo_empleado as string,
    nombreCompleto: row.nombre_completo as string,
    puesto: (row.puesto as string | null) ?? null,
    fechaIngreso: row.fecha_ingreso as string,
    isrEstado: row.isr_estado as string | null,
    imssEstado: row.imss_estado as string | null,
    isrRetenido: Number(row.isr_retenido ?? 0),
    imssRetenido: Number(row.imss_retenido ?? 0),
    subsidioConDerecho: Boolean(row.subsidio_con_derecho),
    subsidioCausado: Number(row.subsidio_causado ?? 0),
    sbc: row.sbc === null ? null : Number(row.sbc),
    hasUncalculatedExemption: Boolean(row.has_uncalculated_exemption),
    perceptions,
    overtimeDays,
    payrollIssuerUid,
    issuerRegistroPatronal: issuer?.registro_patronal ?? null,
    issuerCurp: issuer?.curp_emisor ?? null,
    issuerRiesgoPuesto: issuer?.riesgo_puesto ?? null,
  };
}

async function loadPayrollCfdiPerceptions(idPeriodEmployee: number): Promise<PayrollCfdiPerceptionLine[]> {
  const rows = await db.queryParams(
    `SELECT pep.id_perception, cat.clave_sat,
            CAST(pep.importe AS float) AS importe,
            CAST(ISNULL(pep.importe_gravado, 0) AS float) AS importe_gravado,
            CAST(ISNULL(pep.importe_exento, 0) AS float) AS importe_exento
       FROM [CentroPodologico].[payroll].[period_employee_perceptions] pep
       JOIN [CentroPodologico].[payroll].[perceptions] cat ON cat.id_perception = pep.id_perception
      WHERE pep.id_period_employee = @id_period_employee
      ORDER BY pep.id_perception`,
    { id_period_employee: idPeriodEmployee }
  );
  return rows.map((row) => ({
    idPerception: Number(row.id_perception),
    claveSat: row.clave_sat as string,
    importe: Number(row.importe),
    importeGravado: Number(row.importe_gravado),
    importeExento: Number(row.importe_exento),
  }));
}

async function loadPayrollCfdiOvertimeDays(idPeriodEmployee: number): Promise<PayrollCfdiOvertimeDay[]> {
  const rows = await db.queryParams(
    `SELECT CONVERT(varchar(10), fecha, 120) AS fecha,
            CAST(horas_dobles AS float) AS horas_dobles, CAST(importe_dobles AS float) AS importe_dobles,
            CAST(horas_triples AS float) AS horas_triples, CAST(importe_triples AS float) AS importe_triples
       FROM [CentroPodologico].[payroll].[period_employee_overtime]
      WHERE id_period_employee = @id_period_employee
      ORDER BY fecha`,
    { id_period_employee: idPeriodEmployee }
  );
  return rows.map((row) => ({
    fecha: row.fecha as string,
    horasDobles: Number(row.horas_dobles),
    importeDobles: Number(row.importe_dobles),
    horasTriples: Number(row.horas_triples),
    importeTriples: Number(row.importe_triples),
  }));
}

/** Convierte el snapshot crudo en el `PayrollCfdiSource` que arma `buildPayrollCfdiPayload`. */
export function toPayrollCfdiSource(record: PayrollStampingSourceRecord, salarioDiarioIntegrado: number): PayrollCfdiSource {
  return {
    fechaPago: record.fechaPago,
    fechaInicialPago: record.fechaInicio,
    fechaFinalPago: record.fechaFin,
    numDiasPagados: record.numDiasPagados,
    emisor: {
      registroPatronal: record.issuerRegistroPatronal ?? "",
      curp: record.issuerCurp,
    },
    receptor: {
      rfc: record.employee.rfc ?? "",
      curp: record.employee.curp,
      nss: record.employee.nss,
      codigoPostalFiscal: record.employee.codigo_postal_fiscal ?? "",
      nombreCompleto: record.nombreCompleto,
      tipoRegimen: record.employee.tipo_regimen ?? "",
      tipoContrato: record.employee.tipo_contrato ?? "",
      tipoJornada: record.employee.tipo_jornada,
      bancoClave: record.employee.banco,
      cuentaBancaria: record.employee.cuenta_bancaria,
      claveEntFed: record.branchStateKey ?? "",
      periodicidadPagoClaveSat: record.periodicidadClaveSat ?? "",
      riesgoPuesto: record.issuerRiesgoPuesto ?? "",
      numEmpleado: record.codigoEmpleado,
      puesto: record.puesto,
      fechaIngreso: record.fechaIngreso,
      salarioBaseCotApor: record.sbc,
      salarioDiarioIntegrado,
    },
    perceptions: record.perceptions,
    overtimeDays: record.overtimeDays,
    imssRetenido: record.imssRetenido,
    isrRetenido: record.isrRetenido,
    subsidioConDerecho: record.subsidioConDerecho,
    subsidioCausado: record.subsidioCausado,
  } as PayrollCfdiSource;
}

// ---------------------------------------------------------------------------
// Emisor: CSD vigente (siempre vía Facturapi, nunca cacheado localmente)
// ---------------------------------------------------------------------------

/** `true` si la organización tiene un CSD cargado en Facturapi. */
export async function hasActiveCertificate(orgUid: string): Promise<boolean> {
  const remoteOrganization = await getRootClient().organizations.retrieve(orgUid);
  return Boolean(remoteOrganization.certificate?.has_certificate);
}

// ---------------------------------------------------------------------------
// Reserva / cierre del recibo ('P' -> 'T' | 'E')
// ---------------------------------------------------------------------------

export type ReservePayrollReceiptResult =
  | { status: "reserved"; idReceipt: number; externalId: string; attempt: number }
  | { status: "already_stamped" }
  | { status: "in_progress" }
  | { status: "historical_review" };

/**
 * Reserva el recibo en `'P'` dentro de una transacción corta: el índice filtrado
 * `UX_period_employee_cfdi_vigente (id_period_employee, livemode) WHERE estado IN ('P','T','E','X')`
 * es lo que impide que dos clics o dos pestañas timbren el mismo recibo dos veces. Los recibos
 * ya cancelados (`'C'`) se ignoran: tras cancelar, el siguiente timbrado inserta una fila nueva,
 * la cancelada no se toca. Una reserva pendiente requiere conciliación antes de otro envío.
 */
export async function reservePayrollReceipt(
  tx: ITransactionClient,
  idPeriodEmployee: number,
  idPeriod: number,
  idEmpleado: number,
  livemode: boolean,
  orgUid: string,
  userId: number
): Promise<ReservePayrollReceiptResult> {
  const existingRows = await tx.queryParams(
    `SELECT [id_period_employee_cfdi], [estado], [external_id], [intento_timbrado]
       FROM ${SCHEMA_TABLE_CFDI} WITH (UPDLOCK, HOLDLOCK)
      WHERE [id_period_employee] = @id_period_employee AND [livemode] = @livemode
        AND [estado] <> 'C'`,
    { id_period_employee: idPeriodEmployee, livemode }
  );
  const existing = existingRows[0] as { id_period_employee_cfdi: number; estado: PayrollCfdiStatus; external_id: string | null; intento_timbrado: number | null } | undefined;
  const now = buildDate(new Date());

  if (!existing) {
    const inserted = await tx.queryParams(
      `INSERT INTO ${SCHEMA_TABLE_CFDI}
         ([id_period_employee], [id_period], [id_empleado], [livemode], [estado], [org_uid],
          [stamped_by], [created_at], [updated_at], [external_id], [intento_timbrado])
         OUTPUT INSERTED.[id_period_employee_cfdi], INSERTED.[external_id], INSERTED.[intento_timbrado]
       VALUES (@id_period_employee, @id_period, @id_empleado, @livemode, 'P', @org_uid,
               @stamped_by, @now, @now, NEWID(), 1)`,
      { id_period_employee: idPeriodEmployee, id_period: idPeriod, id_empleado: idEmpleado, livemode, org_uid: orgUid, stamped_by: userId, now }
    );
    return { status: "reserved", idReceipt: Number(inserted[0].id_period_employee_cfdi), externalId: String(inserted[0].external_id), attempt: 1 };
  }

  if (existing.estado === "T" || existing.estado === "X") return { status: "already_stamped" };

  if (existing.estado === "P") return { status: "in_progress" };
  if (!existing.external_id && livemode) return { status: "historical_review" };

  // Un error resuelto permite reservar el siguiente intento.
  const updated = await tx.queryParams(
    `UPDATE ${SCHEMA_TABLE_CFDI}
        SET [estado] = 'P', [org_uid] = @org_uid, [facturapi_id] = NULL, [uuid] = NULL,
            [serie] = NULL, [folio] = NULL, [total] = NULL, [fecha_timbrado] = NULL,
            [mensaje_error] = NULL, [stamped_by] = @stamped_by, [updated_at] = @now,
            [external_id] = COALESCE([external_id], NEWID()), [intento_timbrado] = COALESCE([intento_timbrado], 0) + 1
       OUTPUT INSERTED.[external_id], INSERTED.[intento_timbrado]
      WHERE [id_period_employee_cfdi] = @id`,
    { id: existing.id_period_employee_cfdi, org_uid: orgUid, stamped_by: userId, now }
  );
  return { status: "reserved", idReceipt: existing.id_period_employee_cfdi, externalId: String(updated[0].external_id), attempt: Number(updated[0].intento_timbrado) };
}

export interface CompletePayrollReceiptInput {
  idReceipt:    number;
  attempt:      number;
  externalId:   string;
  facturapiId:  string;
  uuid:         string;
  folio:        number;
  total:        number;
  idEmpresa:    number;
  idUser:       number;
  orgUid:       string;
  livemode:     boolean;
  idPeriod:     number;
  idEmpleado:   number;
}

/** Cierra el recibo en `'T'` y escribe `payroll_receipt.stamp` en la misma transacción. */
export async function completePayrollReceipt(
  tx: ITransactionClient,
  input: CompletePayrollReceiptInput
): Promise<"updated" | "already_saved" | "conflict"> {
  const now = buildDate(new Date());
  const updated = await tx.queryParams(
    `UPDATE ${SCHEMA_TABLE_CFDI}
        SET [estado] = 'T', [facturapi_id] = @facturapi_id, [uuid] = @uuid, [serie] = 'NOM',
            [folio] = @folio, [total] = @total, [fecha_timbrado] = @now, [mensaje_error] = NULL,
            [updated_at] = @now
       OUTPUT INSERTED.[id_period_employee_cfdi]
      WHERE [id_period_employee_cfdi] = @id AND [estado] = 'P'
        AND [external_id] = @external_id AND [intento_timbrado] = @attempt`,
    {
      id: input.idReceipt, facturapi_id: input.facturapiId, uuid: input.uuid,
      folio: input.folio, total: input.total, now, external_id: input.externalId, attempt: input.attempt,
    }
  );

  if (!updated.length) {
    const rows = await tx.queryParams(`SELECT [uuid] FROM ${SCHEMA_TABLE_CFDI} WHERE [id_period_employee_cfdi] = @id AND [estado] = 'T' AND [external_id] = @external_id AND [intento_timbrado] = @attempt`, { id: input.idReceipt, external_id: input.externalId, attempt: input.attempt });
    return rows[0]?.uuid && String(rows[0].uuid).toLowerCase() === input.uuid.toLowerCase() ? "already_saved" : "conflict";
  }
  await writeAuditEntry(tx, {
    id_empresa: input.idEmpresa,
    id_user: input.idUser,
    action: "payroll_receipt.stamp",
    org_uid: input.orgUid,
    target_id: input.uuid,
    mode: input.livemode ? "live" : "test",
    detail: JSON.stringify({
      id_period: input.idPeriod,
      id_empleado: input.idEmpleado,
      facturapi_id: input.facturapiId,
      folio: input.folio,
    }),
  });
  return "updated";
}

/** Cierra el recibo en `'E'` con el mensaje del PAC o de Facturapi, tal cual. */
export async function failPayrollReceipt(idReceipt: number, attempt: number, externalId: string, mensajeError: string): Promise<void> {
  const now = buildDate(new Date());
  await db.queryParams(
    `UPDATE ${SCHEMA_TABLE_CFDI}
        SET [estado] = 'E', [mensaje_error] = @mensaje_error, [updated_at] = @now
      WHERE [id_period_employee_cfdi] = @id AND [estado] = 'P' AND [external_id] = @external_id AND [intento_timbrado] = @attempt`,
    { id: idReceipt, attempt, external_id: externalId, mensaje_error: mensajeError, now }
  );
}

// ---------------------------------------------------------------------------
// Lecturas para la UI (Procesar y Detalle) y el candado de Reabrir
// ---------------------------------------------------------------------------

export interface PayrollCfdiDownloadTarget {
  receipt:        IPayrollCfdiReceipt;
  codigoEmpleado: string;
}

/**
 * El recibo para descargar su XML/PDF/acuse, con el tenant ya validado por el `JOIN` hasta
 * `RH.empleados.id_empresa`. `null` si no existe o no es de esta empresa. El XML y el PDF
 * responden para `'T'`, `'X'` y `'C'`; el acuse solo para `'C'` (spec 99) — cada ruta valida
 * el `estado` del recibo devuelto según lo que le toca servir.
 */
export async function loadPayrollCfdiReceiptForDownload(
  idReceipt: number,
  idEmpresa: number
): Promise<PayrollCfdiDownloadTarget | null> {
  const rows = await db.queryParams(
    `SELECT cfdi.[id_period_employee_cfdi], cfdi.[id_period_employee], cfdi.[id_period], cfdi.[id_empleado],
            cfdi.[livemode], cfdi.[estado],
            cfdi.[org_uid], cfdi.[external_id], cfdi.[intento_timbrado], cfdi.[facturapi_id], cfdi.[uuid], cfdi.[serie], cfdi.[folio],
            CAST(cfdi.[total] AS float) AS total,
            CONVERT(varchar(19), cfdi.[fecha_timbrado], 120) AS fecha_timbrado,
            cfdi.[mensaje_error], cfdi.[stamped_by],
            cfdi.[motivo_cancelacion],
            CONVERT(varchar(19), cfdi.[cancelacion_solicitada_at], 120) AS cancelacion_solicitada_at,
            CONVERT(varchar(19), cfdi.[fecha_cancelacion], 120) AS fecha_cancelacion,
            cfdi.[cancelled_by],
            CONVERT(varchar(19), cfdi.[created_at], 120) AS created_at,
            CONVERT(varchar(19), cfdi.[updated_at], 120) AS updated_at,
            e.codigo_empleado
       FROM ${SCHEMA_TABLE_CFDI} cfdi
       JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = cfdi.id_empleado
      WHERE cfdi.id_period_employee_cfdi = @id_receipt AND e.id_empresa = @id_empresa`,
    { id_receipt: idReceipt, id_empresa: idEmpresa }
  );
  const row = rows[0];
  if (!row) return null;
  return { receipt: normalizeReceiptRow(row), codigoEmpleado: row.codigo_empleado as string };
}

/** El recibo vigente (de cualquier modo) de una fila, el más reciente si hay de los dos. Ignora los cancelados. */
export async function loadPayrollCfdiReceipt(idPeriodEmployee: number): Promise<IPayrollCfdiReceipt | null> {
  const rows = await db.queryParams(
    `SELECT ${RECEIPT_SELECT_COLUMNS}
       FROM ${SCHEMA_TABLE_CFDI} cfdi
      WHERE cfdi.[id_period_employee] = @id_period_employee AND cfdi.[estado] <> 'C'
      ORDER BY [livemode] DESC, [updated_at] DESC`,
    { id_period_employee: idPeriodEmployee }
  );
  return rows[0] ? normalizeReceiptRow(rows[0]) : null;
}

/** Los recibos vigentes (Test y Live) de todas las filas fiscales del periodo, para la columna "CFDI". */
export async function loadPeriodPayrollCfdiReceipts(idPeriod: number): Promise<Map<number, IPayrollCfdiReceipt[]>> {
  const rows = await db.queryParams(
    `SELECT ${RECEIPT_SELECT_COLUMNS}
       FROM ${SCHEMA_TABLE_CFDI} cfdi
       JOIN ${SCHEMA_TABLE_PERIOD_EMPLOYEES} pe ON pe.id_period_employee = cfdi.id_period_employee
      WHERE pe.id_period = @id_period AND cfdi.[estado] <> 'C'`,
    { id_period: idPeriod }
  );

  const receiptsByRow = new Map<number, IPayrollCfdiReceipt[]>();
  for (const row of rows) {
    const receipt = normalizeReceiptRow(row);
    // El JOIN a period_employees garantiza id_period_employee no nulo para estas filas vigentes.
    const idPeriodEmployee = receipt.id_period_employee as number;
    const existing = receiptsByRow.get(idPeriodEmployee) ?? [];
    existing.push(receipt);
    receiptsByRow.set(idPeriodEmployee, existing);
  }
  return receiptsByRow;
}

interface PayrollCfdiStateRow {
  idPeriodEmployee: number;
  idEmpleado:       number;
  state:            PayrollCfdiRowState;
}

const NO_PAYROLL_ISSUER_SUMMARY: PayrollIssuerSummary = { active: false, hasCertificate: false, name: null, isLive: false };

interface PayrollCfdiStateRowsResult {
  rows:   PayrollCfdiStateRow[];
  issuer: PayrollIssuerSummary;
}

/**
 * Estado "CFDI" de cada fila fiscal del periodo, en el orden de la tabla de Procesar: bloqueos
 * vía `getPayrollStampingBlockReasons` + el recibo del modo vigente de la organización emisora.
 * Una sola llamada a Facturapi (el CSD) para todo el periodo, no una por fila.
 */
async function loadPeriodPayrollCfdiStateRows(
  idPeriod: number,
  idSucursal: number
): Promise<PayrollCfdiStateRowsResult> {
  const periodRows = await db.queryParams(
    `SELECT p.[tipo_periodo], p.[status], s.[id_empresa]
       FROM [CentroPodologico].[payroll].[periods] p
       JOIN [CentroPodologico].[dbo].[sucursales] s ON s.id_sucursal = p.id_sucursal
      WHERE p.id_period = @id_period AND p.id_sucursal = @id_sucursal`,
    { id_period: idPeriod, id_sucursal: idSucursal }
  );
  const periodRow = periodRows[0];
  if (!periodRow) return { rows: [], issuer: NO_PAYROLL_ISSUER_SUMMARY };

  const periodType = periodRow.tipo_periodo as PayrollPeriodType;
  const periodStatus = Number(periodRow.status) as PayrollPeriodStatus;
  const idEmpresa = Number(periodRow.id_empresa);

  const [rows, receiptsByRow, payrollIssuerUid] = await Promise.all([
    db.queryParams(
      `SELECT pe.id_period_employee, pe.id_empleado,
              pe.isr_estado, pe.imss_estado,
              e.rfc, e.curp, e.nss, e.salario_diario_fiscal, e.id_periodo_pago,
              e.codigo_postal_fiscal, e.tipo_regimen, e.tipo_contrato, e.tipo_jornada,
              e.banco, e.cuenta_bancaria,
              st.state_key AS clave_estado_sat,
              CASE WHEN EXISTS (
                     SELECT 1 FROM [CentroPodologico].[payroll].[period_employee_perceptions] uncalc
                      WHERE uncalc.id_period_employee = pe.id_period_employee AND uncalc.exencion_estado = 'N'
                   ) THEN 1 ELSE 0 END AS has_uncalculated_exemption
         FROM ${SCHEMA_TABLE_PERIOD_EMPLOYEES} pe
         JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = pe.id_empleado
         JOIN [CentroPodologico].[dbo].[sucursales] s ON s.id_sucursal = e.id_sucursal
         LEFT JOIN [CentroPodologico].[dbo].[Cat_states] st ON st.id_state = s.id_state
        WHERE pe.id_period = @id_period AND pe.tipo_nomina = 'F'
        ORDER BY e.apellido_paterno, e.apellido_materno, e.nombre, pe.id_empleado`,
      { id_period: idPeriod }
    ),
    loadPeriodPayrollCfdiReceipts(idPeriod),
    getPayrollIssuerUid(db, idEmpresa),
  ]);

  const issuerRecord = payrollIssuerUid ? await getOrganizationByUid(db, payrollIssuerUid, idEmpresa) : null;
  const hasCertificate = issuerRecord ? await hasActiveCertificate(issuerRecord.uid) : false;
  const currentLivemode = Boolean(issuerRecord?.is_live);
  const issuerSummary: PayrollIssuerSummary = issuerRecord
    ? { active: true, hasCertificate, name: issuerRecord.name ?? issuerRecord.legal_name, isLive: issuerRecord.is_live }
    : NO_PAYROLL_ISSUER_SUMMARY;

  const stateRows: PayrollCfdiStateRow[] = [];
  for (const row of rows) {
    const idPeriodEmployee = Number(row.id_period_employee);
    const employee: StampingEmployeeInput = {
      salario_diario_fiscal: row.salario_diario_fiscal === null ? null : Number(row.salario_diario_fiscal),
      rfc: row.rfc as string | null,
      curp: row.curp as string | null,
      nss: row.nss as string | null,
      codigo_postal_fiscal: row.codigo_postal_fiscal as string | null,
      tipo_regimen: row.tipo_regimen as string | null,
      tipo_contrato: row.tipo_contrato as string | null,
      tipo_jornada: row.tipo_jornada as string | null,
      id_periodo_pago: row.id_periodo_pago === null ? null : Number(row.id_periodo_pago),
      banco: row.banco as string | null,
      cuenta_bancaria: row.cuenta_bancaria as string | null,
    };

    const reasons = getPayrollStampingBlockReasons({
      periodType,
      periodStatus,
      employee,
      branchStateKey: (row.clave_estado_sat as string | null) ?? null,
      isrEstado: row.isr_estado as string | null,
      imssEstado: row.imss_estado as string | null,
      hasUncalculatedExemption: Boolean(row.has_uncalculated_exemption),
      payrollIssuer: issuerSummary,
    });

    const receipts = receiptsByRow.get(idPeriodEmployee) ?? [];
    const currentReceipt = receipts.find((receipt) => receipt.livemode === currentLivemode) ?? null;

    const state: PayrollCfdiRowState =
      !currentReceipt ? (reasons.length > 0 ? { status: "bloqueado", reasons } : { status: "pendiente" })
      : currentReceipt.estado === "P" ? { status: "en_proceso", receipt: currentReceipt }
      : currentReceipt.estado === "E" ? { status: "error", receipt: currentReceipt }
      : currentReceipt.estado === "X" ? { status: "cancelacion_en_proceso", receipt: currentReceipt }
      : { status: currentLivemode ? "timbrado" : "prueba", receipt: currentReceipt };

    stateRows.push({ idPeriodEmployee, idEmpleado: Number(row.id_empleado), state });
  }
  return { rows: stateRows, issuer: issuerSummary };
}

export interface PayrollCfdiOverview {
  states: Map<number, PayrollCfdiRowState>;
  issuer: PayrollIssuerSummary;
}

/**
 * Estado "CFDI" de cada fila fiscal del periodo (para la columna de Procesar) y el emisor que
 * timbraría hoy (para el aviso de la tabla y la confirmación de "Timbrar pendientes"). Una sola
 * llamada a Facturapi para todo el periodo.
 */
export async function loadPeriodPayrollCfdiOverview(idPeriod: number, idSucursal: number): Promise<PayrollCfdiOverview> {
  const { rows, issuer } = await loadPeriodPayrollCfdiStateRows(idPeriod, idSucursal);
  return { states: new Map(rows.map((row) => [row.idPeriodEmployee, row.state])), issuer };
}

/**
 * `id_empleado` de las filas timbrables pendientes (sin recibo del modo vigente, o en `'E'`),
 * en el orden de la tabla de Procesar: lo que recorre "Timbrar pendientes".
 */
export async function loadPayrollStampingQueue(idPeriod: number, idSucursal: number): Promise<number[]> {
  const { rows } = await loadPeriodPayrollCfdiStateRows(idPeriod, idSucursal);
  return rows
    .filter((row) => row.state.status === "pendiente" || (row.state.status === "error" && (!row.state.receipt?.livemode || row.state.receipt.external_id !== null)))
    .map((row) => row.idEmpleado);
}

/**
 * Candado de operaciones sobre el periodo. Para cálculos también incluye errores históricos sin revisar.
 */
export async function hasLiveStampedReceipts(idPeriod: number, includeHistoricalErrors = false): Promise<boolean> {
  const rows = await db.queryParams(
    `SELECT TOP 1 1 AS found
       FROM ${SCHEMA_TABLE_CFDI} cfdi
      WHERE cfdi.id_period = @id_period AND cfdi.livemode = 1
        AND (cfdi.estado IN ('P','T','X') OR (@include_historical = 1 AND cfdi.estado = 'E' AND cfdi.external_id IS NULL))`,
    { id_period: idPeriod, include_historical: includeHistoricalErrors }
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Cancelación del recibo ('T' -> 'X' -> 'C', o 'X' -> 'T' si el SAT la rechaza)
// ---------------------------------------------------------------------------

export type ReservePayrollCancellationResult =
  | { status: "reserved"; receipt: IPayrollCfdiReceipt }
  | { status: "not_found" }
  | { status: "not_cancellable" };

/**
 * Reserva la cancelación con `UPDLOCK`, igual candado que el timbrado: se niega si la fila no
 * existe o no está en `'T'` (ya cancelada, en proceso, o nunca timbrada). Devuelve el recibo tal
 * como estaba antes de pasar a `'X'` -- `org_uid`/`facturapi_id` son los que la server action usa
 * para llamar a Facturapi con el emisor guardado en el recibo, no el activo.
 */
export async function reservePayrollCancellation(
  tx: ITransactionClient,
  idReceipt: number,
  motive: PayrollCfdiCancellationMotive,
  userId: number
): Promise<ReservePayrollCancellationResult> {
  const rows = await tx.queryParams(
    `SELECT ${RECEIPT_SELECT_COLUMNS}
       FROM ${SCHEMA_TABLE_CFDI} cfdi WITH (UPDLOCK, HOLDLOCK)
      WHERE cfdi.[id_period_employee_cfdi] = @id_receipt`,
    { id_receipt: idReceipt }
  );
  const row = rows[0];
  if (!row) return { status: "not_found" };

  const receipt = normalizeReceiptRow(row);
  if (receipt.estado !== "T") return { status: "not_cancellable" };

  const now = buildDate(new Date());
  const reserved = await tx.queryParams(
    `UPDATE ${SCHEMA_TABLE_CFDI}
        SET [estado] = 'X', [motivo_cancelacion] = @motive,
            [cancelacion_solicitada_at] = CASE WHEN [updated_at] >= @now THEN DATEADD(second, 1, [updated_at]) ELSE @now END,
            [cancelled_by] = @cancelled_by, [updated_at] = @now
      OUTPUT CONVERT(varchar(19), INSERTED.[cancelacion_solicitada_at], 120) AS requested_at
      WHERE [id_period_employee_cfdi] = @id`,
    { id: idReceipt, motive, now, cancelled_by: userId }
  );

  return { status: "reserved", receipt: { ...receipt, cancelacion_solicitada_at: String(reserved[0].requested_at) } };
}

export interface CompletePayrollCancellationInput {
  idReceipt:   number;
  idEmpresa:   number;
  idUser:      number;
  orgUid:      string;
  uuid:        string;
  livemode:    boolean;
  idPeriod:    number;
  idEmpleado:  number;
  facturapiId: string;
  folio:       number | null;
  motive:      PayrollCfdiCancellationMotive;
  requestedAt: string;
}

/** Cierra la cancelación en `'C'` y escribe `payroll_receipt.cancel` en la misma transacción. */
export async function completePayrollCancellation(
  tx: ITransactionClient,
  input: CompletePayrollCancellationInput
): Promise<boolean> {
  const now = buildDate(new Date());
  const updated = await tx.queryParams(
    `UPDATE ${SCHEMA_TABLE_CFDI}
        SET [estado] = 'C', [fecha_cancelacion] = @now, [updated_at] = @now
      OUTPUT INSERTED.[id_period_employee_cfdi]
      WHERE [id_period_employee_cfdi] = @id AND [estado] = 'X' AND [cancelacion_solicitada_at] = @requested_at`,
    { id: input.idReceipt, now, requested_at: input.requestedAt }
  );

  if (!updated.length) return false;

  await writeAuditEntry(tx, {
    id_empresa: input.idEmpresa,
    id_user: input.idUser,
    action: "payroll_receipt.cancel",
    org_uid: input.orgUid,
    target_id: input.uuid,
    mode: input.livemode ? "live" : "test",
    detail: JSON.stringify({
      id_period: input.idPeriod,
      id_empleado: input.idEmpleado,
      facturapi_id: input.facturapiId,
      folio: input.folio,
      motivo: input.motive,
    }),
  });
  return true;
}

/**
 * Revierte `'X'` -> `'T'` solo ante rechazo explícito de la solicitud consultada, y limpia
 * las columnas de cancelación -- la fila queda exactamente como antes de intentar cancelarla.
 */
export async function revertPayrollCancellation(idReceipt: number, requestedAt: string): Promise<void> {
  await db.queryParams(
    `UPDATE ${SCHEMA_TABLE_CFDI}
        SET [estado] = 'T', [motivo_cancelacion] = NULL, [cancelacion_solicitada_at] = NULL,
            [cancelled_by] = NULL, [updated_at] = [cancelacion_solicitada_at]
      WHERE [id_period_employee_cfdi] = @id AND [estado] = 'X' AND [cancelacion_solicitada_at] = @requested_at`,
    { id: idReceipt, requested_at: requestedAt }
  );
}

/**
 * Historial de recibos cancelados de un empleado en un periodo, para el Detalle: UUID, serie-folio,
 * motivo, fecha y quién canceló. El tenant se valida con el `JOIN` hasta `RH.empleados`.
 */
export async function loadCancelledPayrollReceipts(
  idPeriod: number,
  idEmpleado: number,
  idEmpresa: number
): Promise<PayrollCfdiCancelledReceipt[]> {
  const rows = await db.queryParams(
    `SELECT cfdi.[id_period_employee_cfdi], cfdi.[uuid], cfdi.[folio], cfdi.[livemode], cfdi.[motivo_cancelacion],
            CONVERT(varchar(19), cfdi.[fecha_cancelacion], 120) AS fecha_cancelacion,
            u.[nombre] AS cancelled_by_name
       FROM ${SCHEMA_TABLE_CFDI} cfdi
       JOIN [CentroPodologico].[RH].[empleados] e ON e.id_empleado = cfdi.id_empleado
       LEFT JOIN [CentroPodologico].[dbo].[users] u ON u.[id_user] = cfdi.[cancelled_by]
      WHERE cfdi.[id_period] = @id_period AND cfdi.[id_empleado] = @id_empleado
        AND cfdi.[estado] = 'C' AND e.[id_empresa] = @id_empresa
      ORDER BY cfdi.[fecha_cancelacion] DESC`,
    { id_period: idPeriod, id_empleado: idEmpleado, id_empresa: idEmpresa }
  );
  return rows.map((row) => ({
    idReceipt: Number(row.id_period_employee_cfdi),
    uuid: row.uuid as string,
    serieFolio: `NOM-${row.folio}`,
    livemode: Boolean(row.livemode),
    motivoCancelacion: row.motivo_cancelacion as PayrollCfdiCancellationMotive,
    fechaCancelacion: row.fecha_cancelacion as string,
    cancelledByName: (row.cancelled_by_name as string | null) ?? "—",
  }));
}
