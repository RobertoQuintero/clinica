// Siembra de entradas de nómina de la Empresa Demo (spec 93, paso 3 del plan): configuraciones por
// empresa, checadas deterministas, pacientes y consultas, un tratamiento de onicomicosis liquidado,
// productos demo con bono_venta y ventas en consultas y en mostrador. Corre dentro del mismo
// `db.transaction` que `seedOrganization`, nunca suelto. Las fechas siempre viajan como texto
// ("YYYY-MM-DD" / "YYYY-MM-DD HH:mm:ss"), nunca como `Date` (ver CLAUDE.md).
import type { ITransactionClient } from "@/database/connection";
import { applyStockMovement } from "@/lib/inventory/stock";
import { addZeroToday, buildDate } from "@/utils/date_helpper";
import { createWebId } from "@/utils/random";
import { DEMO_EMPLOYEES, DEMO_PAYMENT_PERIOD_ID_WEEKLY, type IDemoEmployeeFixture } from "./constants";
import type { ISeededDemoOrganization } from "./seedOrganization";

const MOVEMENT_SALIDA_POR_VENTA = 6;
const MOVEMENT_ENTRADA_POR_AJUSTE = 7;
const METODO_PAGO_EFECTIVO = 1;
const MAX_SQL_SERVER_PARAMETERS = 2000; // margen bajo el límite real de 2100

// ── Fechas puras, sobre strings "YYYY-MM-DD" (nunca Date) ──────────────────────────────────────

function toEpochDay(dateOnly: string): number {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

/** 1 = lunes … 7 = domingo. Misma regla que `calculatePayrollPeriod` (1900-01-01 fue lunes). */
function isoWeekdayOf(dateOnly: string): number {
  const epoch1900 = Math.floor(Date.UTC(1900, 0, 1) / 86400000);
  return (((toEpochDay(dateOnly) - epoch1900) % 7) + 7) % 7 + 1;
}

function addDaysToDate(dateOnly: string, days: number): string {
  const date = new Date((toEpochDay(dateOnly) + days) * 86400000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMinutesToDateTime(dateTime: string, minutes: number): string {
  const [datePart, timePart] = dateTime.split(" ");
  const [hour, minute, second] = timePart.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  const newHour = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const newMinute = String(total % 60).padStart(2, "0");
  return `${datePart} ${newHour}:${newMinute}:${String(second).padStart(2, "0")}`;
}

interface IWeekRange {
  monday: string;
  saturday: string;
}

/** La última semana lunes-sábado totalmente transcurrida antes de la semana en curso. */
function mostRecentCompletedWeek(todayDateOnly: string): IWeekRange {
  const weekday = isoWeekdayOf(todayDateOnly);
  const currentMonday = addDaysToDate(todayDateOnly, -(weekday - 1));
  const monday = addDaysToDate(currentMonday, -7);
  return { monday, saturday: addDaysToDate(monday, 5) };
}

// ── Helpers de inserción ────────────────────────────────────────────────────────────────────────

async function fetchNextId(tx: ITransactionClient, table: string, column: string): Promise<number> {
  const rows = (await tx.queryParams(
    `SELECT ISNULL(MAX([${column}]), 0) + 1 AS next_id FROM ${table}`,
    {},
  )) as { next_id: number }[];
  return rows[0].next_id;
}

/**
 * INSERT multi-renglón en bloques, respetando el límite de 2100 parámetros de SQL Server. No sirve
 * para tablas cuyo PK se genera con `MAX+1` inline (todas las filas del mismo bloque leerían el
 * mismo MAX): esas tablas reciben su id ya resuelto en `rows` antes de llamar a esta función.
 */
async function batchInsert(
  tx: ITransactionClient,
  table: string,
  columns: readonly string[],
  rows: readonly Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const rowsPerBatch = Math.max(1, Math.floor(MAX_SQL_SERVER_PARAMETERS / columns.length));
  const columnList = columns.map((column) => `[${column}]`).join(", ");

  for (let start = 0; start < rows.length; start += rowsPerBatch) {
    const chunk = rows.slice(start, start + rowsPerBatch);
    const params: Record<string, unknown> = {};
    const valuesSql = chunk
      .map((row, rowIndex) => {
        const placeholders = columns.map((column) => {
          const paramName = `r${rowIndex}_${column}`;
          params[paramName] = row[column];
          return `@${paramName}`;
        });
        return `(${placeholders.join(", ")})`;
      })
      .join(",\n       ");

    await tx.queryParams(`INSERT INTO ${table} (${columnList}) VALUES ${valuesSql}`, params);
  }
}

// ── Configuraciones de nómina por empresa ──────────────────────────────────────────────────────

/** Mismos valores que la semilla original de la empresa real (queries.txt), para la Empresa Demo. */
async function seedCompanyPayrollConfigs(
  tx: ITransactionClient,
  id_empresa: number,
  updated_by: number,
): Promise<void> {
  const now = buildDate(new Date());

  await tx.queryParams(
    `INSERT INTO [CentroPodologico].[payroll].[commission_tiers]
       ([id_empresa], [min_consultas], [max_consultas], [importe], [created_by], [created_at])
     VALUES
       (@id_empresa, 1, 10, 100.00, @created_by, @created_at),
       (@id_empresa, 11, 25, 200.00, @created_by, @created_at),
       (@id_empresa, 26, 35, 300.00, @created_by, @created_at),
       (@id_empresa, 36, NULL, 500.00, @created_by, @created_at)`,
    { id_empresa, created_by: updated_by, created_at: now },
  );

  await tx.queryParams(
    `INSERT INTO [CentroPodologico].[payroll].[treatment_commission_settings]
       ([id_empresa], [importe_por_tratamiento], [umbral_liquidacion], [updated_by], [updated_at])
     VALUES (@id_empresa, 500.00, 5000.00, @updated_by, @updated_at)`,
    { id_empresa, updated_by, updated_at: now },
  );

  await tx.queryParams(
    `INSERT INTO [CentroPodologico].[payroll].[overtime_settings]
       ([id_empresa], [limite_horas_dobles_periodo], [tope_horas_dia], [updated_by], [updated_at])
     VALUES (@id_empresa, 9.0, 16.0, @updated_by, @updated_at)`,
    { id_empresa, updated_by, updated_at: now },
  );

  await tx.queryParams(
    `INSERT INTO [CentroPodologico].[payroll].[lateness_settings]
       ([id_empresa], [tolerancia_minutos], [minutos_retardo_grave], [dias_descuento_retardo_grave],
        [updated_by], [updated_at])
     VALUES (@id_empresa, 10, 30, 0.5, @updated_by, @updated_at)`,
    { id_empresa, updated_by, updated_at: now },
  );
  await tx.queryParams(
    `INSERT INTO [CentroPodologico].[payroll].[lateness_tiers] ([id_empresa], [id_payment_period], [retardos], [dias_descuento])
     VALUES
       (@id_empresa, @id_payment_period, 1, 0.5),
       (@id_empresa, @id_payment_period, 2, 1.0)`,
    { id_empresa, id_payment_period: DEMO_PAYMENT_PERIOD_ID_WEEKLY },
  );

  await tx.queryParams(
    `INSERT INTO [CentroPodologico].[payroll].[punctuality_bonus_settings]
       ([id_empresa], [id_payment_period], [monto], [maximo_incidencias], [status], [updated_by], [updated_at])
     VALUES (@id_empresa, @id_payment_period, 500.00, 1, 1, @updated_by, @updated_at)`,
    { id_empresa, id_payment_period: DEMO_PAYMENT_PERIOD_ID_WEEKLY, updated_by, updated_at: now },
  );
  await tx.queryParams(
    `INSERT INTO [CentroPodologico].[payroll].[attendance_bonus_settings]
       ([id_empresa], [id_payment_period], [monto], [status], [updated_by], [updated_at])
     VALUES (@id_empresa, @id_payment_period, 500.00, 1, @updated_by, @updated_at)`,
    { id_empresa, id_payment_period: DEMO_PAYMENT_PERIOD_ID_WEEKLY, updated_by, updated_at: now },
  );
}

async function seedShiftExtensionAssignment(
  tx: ITransactionClient,
  id_empleado: number,
  updated_by: number,
): Promise<void> {
  await tx.queryParams(
    `INSERT INTO [CentroPodologico].[payroll].[shift_extension_assignments] ([id_empleado], [activo], [updated_by], [updated_at])
     VALUES (@id_empleado, 1, @updated_by, @updated_at)`,
    { id_empleado, updated_by, updated_at: buildDate(new Date()) },
  );
}

// ── Checador y checadas ─────────────────────────────────────────────────────────────────────────

async function seedChecador(tx: ITransactionClient, id_sucursal: number): Promise<number> {
  const rows = (await tx.queryParams(
    `INSERT INTO [CentroPodologico].[RH].[checadores] ([sn], [id_sucursal], [nombre], [activo], [status], [created_at])
     OUTPUT INSERTED.[id_checador]
     VALUES (@sn, @id_sucursal, @nombre, 1, 1, @created_at)`,
    { sn: "DEMO-CHECADOR-001", id_sucursal, nombre: "Checador Demo", created_at: buildDate(new Date()) },
  )) as { id_checador: number }[];
  return rows[0].id_checador;
}

type EntradaOrSalida = "entrada" | "salida";

interface IAttendancePunch {
  fecha_hora: string;
  tipo: EntradaOrSalida;
}

// Desplazamiento (0 = lunes … 5 = sábado) de cada escenario dentro de la semana ya terminada.
const OVERTIME_DAY_OFFSETS = [1, 3]; // martes y jueves: 2 h extra
const INCOMPLETE_PUNCH_OFFSET = 2; // miércoles: solo entrada
const LATENESS_ACCUMULABLE_OFFSET = 0; // lunes: 15 min (acumulable)
const LATENESS_SEVERE_OFFSET = 4; // viernes: 35 min (grave)
const ABSENCE_OFFSET = 0; // lunes: ninguna checada

/** Checadas de un empleado desde su ingreso hasta `throughDateInclusive`, con sus escenarios. */
function buildEmployeeAttendance(
  fixture: IDemoEmployeeFixture,
  fechaIngreso: string,
  throughDateInclusive: string,
  scenarioWeek: IWeekRange,
): IAttendancePunch[] {
  const punches: IAttendancePunch[] = [];
  if (fechaIngreso > throughDateInclusive) return punches;

  const hasScenario = (scenario: IDemoEmployeeFixture["scenarios"][number]) =>
    fixture.scenarios.includes(scenario);

  for (let cursor = fechaIngreso; cursor <= throughDateInclusive; cursor = addDaysToDate(cursor, 1)) {
    if (isoWeekdayOf(cursor) > 6) continue; // domingo: descanso

    const inScenarioWeek = cursor >= scenarioWeek.monday && cursor <= scenarioWeek.saturday;
    const offset = inScenarioWeek ? toEpochDay(cursor) - toEpochDay(scenarioWeek.monday) : null;

    let entrada = "09:00:00";
    let salida: string | null = "18:00:00";

    if (offset !== null && hasScenario("absences") && offset === ABSENCE_OFFSET) {
      continue; // falta: ninguna checada ese día
    }
    if (offset !== null && hasScenario("incompletePunch") && offset === INCOMPLETE_PUNCH_OFFSET) {
      salida = null;
    } else if (offset !== null && hasScenario("overtime") && OVERTIME_DAY_OFFSETS.includes(offset)) {
      salida = "20:00:00";
    } else if (offset !== null && hasScenario("lateness") && offset === LATENESS_ACCUMULABLE_OFFSET) {
      entrada = "09:15:00";
    } else if (offset !== null && hasScenario("lateness") && offset === LATENESS_SEVERE_OFFSET) {
      entrada = "09:35:00";
    }

    punches.push({ fecha_hora: `${cursor} ${entrada}`, tipo: "entrada" });
    if (salida) punches.push({ fecha_hora: `${cursor} ${salida}`, tipo: "salida" });
  }
  return punches;
}

async function seedAttendance(
  tx: ITransactionClient,
  context: ISeededDemoOrganization,
  id_checador: number,
  throughDateInclusive: string,
  scenarioWeek: IWeekRange,
): Promise<void> {
  const rows: Record<string, unknown>[] = [];

  for (const fixture of DEMO_EMPLOYEES) {
    const id_empleado = context.employeeIdsByKey[fixture.key];
    const fechaIngreso = context.fechaIngresoByKey[fixture.key];
    const punches = buildEmployeeAttendance(fixture, fechaIngreso, throughDateInclusive, scenarioWeek);
    for (const punch of punches) {
      rows.push({
        id_empleado,
        id_checador,
        fecha_hora: punch.fecha_hora,
        tipo: punch.tipo,
        created_at: punch.fecha_hora,
      });
    }
  }

  await batchInsert(
    tx,
    "[CentroPodologico].[RH].[asistencias]",
    ["id_empleado", "id_checador", "fecha_hora", "tipo", "created_at"],
    rows,
  );
}

// ── Productos demo ──────────────────────────────────────────────────────────────────────────────

interface IDemoProductFixture {
  name: string;
  price: number;
  sale_price: number;
  bono_venta: number;
}

const DEMO_PRODUCTS: readonly IDemoProductFixture[] = [
  { name: "Crema Demo Hidratante", price: 180, sale_price: 220, bono_venta: 15 },
  { name: "Lima Demo Profesional", price: 90, sale_price: 120, bono_venta: 8 },
  { name: "Gel Demo Antifúngico", price: 250, sale_price: 310, bono_venta: 25 },
];

/** Crea los productos demo y les da un stock inicial generoso en la Sucursal Demo. Devuelve sus ids. */
async function seedProducts(tx: ITransactionClient, context: ISeededDemoOrganization): Promise<number[]> {
  const created_at = buildDate(new Date());
  const ids: number[] = [];

  for (const product of DEMO_PRODUCTS) {
    const rows = (await tx.queryParams(
      `INSERT INTO [CentroPodologico].[inventory].[Products]
         ([id_product], [name], [price], [sale_price], [split], [auto_consume], [id_empresa],
          [created_at], [activo], [status], [bono_venta])
       OUTPUT INSERTED.[id_product]
       VALUES (
         (SELECT ISNULL(MAX([id_product]), 0) + 1 FROM [CentroPodologico].[inventory].[Products]),
         @name, @price, @sale_price, 0, 0, @id_empresa, @created_at, 1, 1, @bono_venta
       )`,
      { ...product, id_empresa: context.id_empresa, created_at },
    )) as { id_product: number }[];
    const id_product = rows[0].id_product;
    ids.push(id_product);

    await applyStockMovement(tx, {
      id_product,
      id_sucursal: context.id_sucursal,
      id_empresa: context.id_empresa,
      id_movement: MOVEMENT_ENTRADA_POR_AJUSTE,
      quantity: 500,
      notes: "Stock inicial de la Empresa Demo",
      id_user: context.id_user_demo,
    });
  }
  return ids;
}

// ── Pacientes ────────────────────────────────────────────────────────────────────────────────────

interface IDemoPatientFixture {
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  sexo: "F" | "M";
  telefono: string;
}

const DEMO_PATIENTS: readonly IDemoPatientFixture[] = [
  { nombre: "Laura", apellido_paterno: "Mendoza", apellido_materno: "Ibarra", sexo: "F", telefono: "7820001001" },
  { nombre: "Jorge", apellido_paterno: "Santos", apellido_materno: "Cruz", sexo: "M", telefono: "7820001002" },
  { nombre: "Patricia", apellido_paterno: "Reyes", apellido_materno: "Luna", sexo: "F", telefono: "7820001003" },
  { nombre: "Miguel", apellido_paterno: "Castro", apellido_materno: "Vega", sexo: "M", telefono: "7820001004" },
  { nombre: "Sofía", apellido_paterno: "Navarro", apellido_materno: "Paredes", sexo: "F", telefono: "7820001005" },
];

async function seedPacientes(tx: ITransactionClient, context: ISeededDemoOrganization): Promise<number[]> {
  const created_at = buildDate(new Date());
  const ids: number[] = [];

  for (const patient of DEMO_PATIENTS) {
    const rows = (await tx.queryParams(
      `INSERT INTO [CentroPodologico].[dbo].[pacientes]
         ([id_paciente], [nombre], [apellido_paterno], [apellido_materno], [telefono], [sexo],
          [id_sucursal], [id_empresa], [created_at])
       OUTPUT INSERTED.[id_paciente]
       VALUES (
         (SELECT ISNULL(MAX([id_paciente]), 0) + 1 FROM [CentroPodologico].[dbo].[pacientes]),
         @nombre, @apellido_paterno, @apellido_materno, @telefono, @sexo,
         @id_sucursal, @id_empresa, @created_at
       )`,
      { ...patient, id_sucursal: context.id_sucursal, id_empresa: context.id_empresa, created_at },
    )) as { id_paciente: number }[];
    ids.push(rows[0].id_paciente);
  }
  return ids;
}

// ── Consultas y ventas en consulta ──────────────────────────────────────────────────────────────

const PODOLOGIST_KEYS = DEMO_EMPLOYEES.filter((fixture) => fixture.role === "podologist").map(
  (fixture) => fixture.key,
);

/**
 * Una consulta atendida por workday (lunes-sábado) desde el ingreso del podólogo más antiguo hasta
 * `throughDateInclusive`, rotando entre los 3 podólogos y los pacientes demo. Una de cada tres
 * lleva una línea de `consulta_productos` con el producto demo (`id_product`), para que "Com.
 * Ventas" también tenga datos en todas las semanas. Devuelve el id de consulta reservado para el
 * tratamiento de onicomicosis (el siguiente libre tras este bloque).
 */
async function seedConsultasAndProductSales(
  tx: ITransactionClient,
  context: ISeededDemoOrganization,
  patientIds: readonly number[],
  id_product: number,
  throughDateInclusive: string,
): Promise<number> {
  const earliestFechaIngreso = PODOLOGIST_KEYS.map((key) => context.fechaIngresoByKey[key]).reduce(
    (earliest, value) => (value < earliest ? value : earliest),
  );

  const workdays: string[] = [];
  for (let cursor = earliestFechaIngreso; cursor <= throughDateInclusive; cursor = addDaysToDate(cursor, 1)) {
    if (isoWeekdayOf(cursor) <= 6) workdays.push(cursor);
  }

  const nextConsultaId = await fetchNextId(tx, "[CentroPodologico].[dbo].[consultas]", "id_consulta");
  const nextProductLineId = await fetchNextId(
    tx,
    "[CentroPodologico].[dbo].[consulta_productos]",
    "id_consulta_producto",
  );

  const consultaRows: Record<string, unknown>[] = [];
  const productLineRows: Record<string, unknown>[] = [];
  const soldConsultaIds: number[] = [];
  let nextProductLineSequence = 0;

  workdays.forEach((day, index) => {
    const id_podologo = context.linkedUserIdsByKey[PODOLOGIST_KEYS[index % PODOLOGIST_KEYS.length]];
    const id_paciente = patientIds[index % patientIds.length];
    const id_consulta = nextConsultaId + index;
    const fecha = `${day} 10:00:00`;
    const fecha_fin = `${day} 10:30:00`;

    consultaRows.push({
      id_consulta,
      id_paciente,
      id_podologo,
      fecha,
      fecha_fin,
      created_at: fecha,
      costo_total: 350,
      id_sucursal: context.id_sucursal,
      id_empresa: context.id_empresa,
      is_onicomicosis: 0,
    });

    if (index % 3 === 0) {
      productLineRows.push({
        id_consulta_producto: nextProductLineId + nextProductLineSequence,
        id_consulta,
        id_producto: id_product,
        precio: 220,
        cantidad: 1,
        status: 1,
        created_at: fecha,
      });
      soldConsultaIds.push(id_consulta);
      nextProductLineSequence += 1;
    }
  });

  await batchInsert(
    tx,
    "[CentroPodologico].[dbo].[consultas]",
    [
      "id_consulta",
      "id_paciente",
      "id_podologo",
      "fecha",
      "fecha_fin",
      "created_at",
      "costo_total",
      "id_sucursal",
      "id_empresa",
      "is_onicomicosis",
    ],
    consultaRows,
  );
  await batchInsert(
    tx,
    "[CentroPodologico].[dbo].[consulta_productos]",
    ["id_consulta_producto", "id_consulta", "id_producto", "precio", "cantidad", "status", "created_at"],
    productLineRows,
  );

  for (const id_consulta of soldConsultaIds) {
    await applyStockMovement(tx, {
      id_product,
      id_sucursal: context.id_sucursal,
      id_empresa: context.id_empresa,
      id_movement: MOVEMENT_SALIDA_POR_VENTA,
      quantity: 1,
      id_consulta,
      id_user: context.id_user_demo,
    });
  }

  return nextConsultaId + workdays.length;
}

// ── Tratamiento de onicomicosis liquidado ──────────────────────────────────────────────────────

/**
 * Una consulta de onicomicosis dedicada (no una de las rotativas) con un tratamiento cuyos pagos
 * parciales llegan al umbral de liquidación dentro de la semana ya calculada, para que "Com.
 * onicomicosis" tenga datos esa semana.
 */
async function seedOnychomycosisTreatment(
  tx: ITransactionClient,
  context: ISeededDemoOrganization,
  reservedConsultaId: number,
  patientId: number,
  scenarioWeek: IWeekRange,
): Promise<void> {
  const id_podologo = context.linkedUserIdsByKey["podologo-1"];
  const fecha = `${scenarioWeek.monday} 09:30:00`;

  await tx.queryParams(
    `INSERT INTO [CentroPodologico].[dbo].[consultas]
       ([id_consulta], [id_paciente], [id_podologo], [fecha], [fecha_fin], [created_at],
        [costo_total], [id_sucursal], [id_empresa], [is_onicomicosis])
     VALUES (@id_consulta, @id_paciente, @id_podologo, @fecha, @fecha_fin, @created_at,
             @costo_total, @id_sucursal, @id_empresa, 1)`,
    {
      id_consulta: reservedConsultaId,
      id_paciente: patientId,
      id_podologo,
      fecha,
      fecha_fin: fecha,
      created_at: fecha,
      costo_total: 5500,
      id_sucursal: context.id_sucursal,
      id_empresa: context.id_empresa,
    },
  );

  const id_tratamiento = await fetchNextId(tx, "[CentroPodologico].[dbo].[Tratamiento_onicomicosis]", "id_tratamiento");
  await tx.queryParams(
    `INSERT INTO [CentroPodologico].[dbo].[Tratamiento_onicomicosis]
       ([id_tratamiento], [id_consulta], [created_at], [id_stage], [id_usuario], [new_message], [message], [id_billing_stage])
     VALUES (@id_tratamiento, @id_consulta, @created_at, 1, @id_usuario, 1, 'SOLICITUD', 1)`,
    { id_tratamiento, id_consulta: reservedConsultaId, created_at: fecha, id_usuario: id_podologo },
  );

  // Anticipo (tipo 1, no cuenta para el umbral) + 3 parciales (tipo 2, status 1) que suman 5,500 y
  // cruzan el umbral de 5,000 en el tercero: ese es el momento de liquidación.
  const payments = [
    { tipo: 1, total: 500, minutesAfter: 0 },
    { tipo: 2, total: 2000, minutesAfter: 5 },
    { tipo: 2, total: 2000, minutesAfter: 10 },
    { tipo: 2, total: 1500, minutesAfter: 15 },
  ] as const;

  const basePagoId = await fetchNextId(
    tx,
    "[CentroPodologico].[dbo].[Tratamiento_onicomicosis_pagos]",
    "id_tratamiento_pago",
  );

  for (const [index, payment] of payments.entries()) {
    const id_tratamiento_pago = basePagoId + index;
    const created_at = addMinutesToDateTime(fecha, payment.minutesAfter);
    await tx.queryParams(
      `INSERT INTO [CentroPodologico].[dbo].[Tratamiento_onicomicosis_pagos]
         ([id_tratamiento_pago], [id_tratamiento], [total], [idMetodoPago], [status], [created_at],
          [facturado], [webid], [id_usuario], [id_tratamiento_pago_tipo])
       VALUES (@id_tratamiento_pago, @id_tratamiento, @total, @idMetodoPago, 1, @created_at,
               0, @webid, @id_usuario, @tipo)`,
      {
        id_tratamiento_pago,
        id_tratamiento,
        total: payment.total,
        idMetodoPago: METODO_PAGO_EFECTIVO,
        created_at,
        webid: `${id_tratamiento_pago}-${createWebId(9)}`,
        id_usuario: id_podologo,
        tipo: payment.tipo,
      },
    );
  }
}

// ── Venta en mostrador ───────────────────────────────────────────────────────────────────────────

/** Una venta de mostrador capturada por el usuario demo (sin empleado vinculado: no comisiona). */
async function seedCounterSale(
  tx: ITransactionClient,
  context: ISeededDemoOrganization,
  id_product: number,
  scenarioWeek: IWeekRange,
): Promise<void> {
  const id_venta = await fetchNextId(tx, "[CentroPodologico].[dbo].[Ventas]", "id_venta");
  const created_at = `${scenarioWeek.saturday} 12:00:00`;
  const cantidad = 2;
  const precio_unitario = 220;
  const total = cantidad * precio_unitario;
  const webid = `${id_venta}-${createWebId(9)}`;

  await tx.queryParams(
    `INSERT INTO [CentroPodologico].[dbo].[Ventas]
       ([id_venta], [id_sucursal], [idMetodoPago], [total], [created_at], [id_usuario], [status], [webid], [facturado])
     VALUES (@id_venta, @id_sucursal, @idMetodoPago, @total, @created_at, @id_usuario, 1, @webid, 0)`,
    {
      id_venta,
      id_sucursal: context.id_sucursal,
      idMetodoPago: METODO_PAGO_EFECTIVO,
      total,
      created_at,
      id_usuario: context.id_user_demo,
      webid,
    },
  );
  await tx.queryParams(
    `INSERT INTO [CentroPodologico].[dbo].[VentasDetalle]
       ([id_venta], [id_producto], [cantidad], [precio_unitario], [subtotal], [created_at])
     VALUES (@id_venta, @id_producto, @cantidad, @precio_unitario, @subtotal, @created_at)`,
    { id_venta, id_producto: id_product, cantidad, precio_unitario, subtotal: total, created_at },
  );

  await applyStockMovement(tx, {
    id_product,
    id_sucursal: context.id_sucursal,
    id_empresa: context.id_empresa,
    id_movement: MOVEMENT_SALIDA_POR_VENTA,
    quantity: cantidad,
    id_venta,
    id_user: context.id_user_demo,
  });
}

// ── Orquestación ────────────────────────────────────────────────────────────────────────────────

export async function seedPayrollInputs(tx: ITransactionClient, context: ISeededDemoOrganization): Promise<void> {
  const yesterday = addDaysToDate(addZeroToday(new Date()), -1);
  const scenarioWeek = mostRecentCompletedWeek(addZeroToday(new Date()));

  await seedCompanyPayrollConfigs(tx, context.id_empresa, context.id_user_demo);
  await seedShiftExtensionAssignment(tx, context.employeeIdsByKey["podologo-2"], context.id_user_demo);

  const id_checador = await seedChecador(tx, context.id_sucursal);
  await seedAttendance(tx, context, id_checador, yesterday, scenarioWeek);

  const productIds = await seedProducts(tx, context);
  const [mainProductId] = productIds;
  const patientIds = await seedPacientes(tx, context);

  const reservedConsultaId = await seedConsultasAndProductSales(tx, context, patientIds, mainProductId, yesterday);
  await seedOnychomycosisTreatment(tx, context, reservedConsultaId, patientIds[0], scenarioWeek);
  await seedCounterSale(tx, context, mainProductId, scenarioWeek);
}
