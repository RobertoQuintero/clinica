import test, { mock } from "node:test";
import assert from "node:assert/strict";

let periodFound = true;
let activeFlag = false;
let missing = false;
let validationFails = false;
let writeFails = false;
let committed = 0;
let rolledBack = 0;
let validationClient: unknown;
let queries: string[] = [];
const period = { id_period: 1, id_sucursal: 2, id_payment_period: 1, fecha_fin: "2026-11-15", tipo_periodo: "O", concepto_extraordinario: null };

const tx = { queryParams: async (sql: string, params: Record<string, unknown>) => {
  queries.push(sql);
  if (sql.includes("SELECT id_period")) {
    assert.equal(params.id_sucursal, 2);
    return periodFound ? [period] : [];
  }
  if (writeFails) throw new Error("write failed");
  return [];
} };
mock.module("@/database/connection", { defaultExport: {
  transaction: async (work: (client: typeof tx) => Promise<void>, options: { serializable: boolean }) => {
    assert.equal(options.serializable, true);
    try { await work(tx); committed++; } catch (error) { rolledBack++; throw error; }
  },
} });
mock.module("@/lib/payroll/access", { namedExports: {
  assertPayrollAccess: async () => ({ ok: true, data: { id_sucursal: 2, id_user: 7 } }),
} });
mock.module("@/lib/payroll/recalculationChecks", { namedExports: {
  collectRecalculationFlags: async (_period: unknown, client: unknown) => {
    validationClient = client;
    if (validationFails) throw new Error("validation failed");
    return { active: activeFlag };
  },
  isAnyRecalculationFlagActive: (flags: { active: boolean }) => flags.active,
} });
mock.module("@/lib/payroll/missingEmployeesRecalculation", { namedExports: {
  loadMissingEligibleEmployees: async (_period: unknown, client: unknown) => {
    validationClient = client;
    if (validationFails) throw new Error("validation failed");
    return missing ? [{}] : [];
  },
} });
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });

async function main() {
  const { approvePayrollPeriod, payPayrollPeriod } = await import("../app/dashboard/nomina/procesar/actions");
  const reset = () => { periodFound = true; activeFlag = false; missing = false; validationFails = false; writeFails = false; committed = 0; rolledBack = 0; queries = []; validationClient = undefined; };
  for (const [name, action, status] of [["aprobar", approvePayrollPeriod, 2], ["pagar", payPayrollPeriod, 3]] as const) {
    test(`${name}: valida y registra la transición en una transacción serializable`, async () => {
      reset();
      assert.equal((await action({ id_period: 1 })).ok, true);
      assert.equal(validationClient, tx);
      assert.equal(committed, 1);
      assert.match(queries[0], /UPDLOCK, HOLDLOCK/);
      assert.match(queries[0], new RegExp(`status = ${status}`));
      assert.match(queries[1], /UPDATE[\s\S]*INSERT INTO \[CentroPodologico\]\.\[payroll\]\.\[period_status_log\]/);
    });
    test(`${name}: rechaza sucursal o estatus incorrectos`, async () => {
      reset(); periodFound = false;
      assert.equal((await action({ id_period: 1 })).ok, false);
      assert.equal(queries.length, 1); assert.equal(committed, 0); assert.equal(rolledBack, 1);
    });
    test(`${name}: revierte si falla la validación o la escritura`, async () => {
      for (const stage of ["validation", "write"]) {
        reset(); validationFails = stage === "validation"; writeFails = stage === "write";
        assert.equal((await action({ id_period: 1 })).ok, false);
        assert.equal(committed, 0); assert.equal(rolledBack, 1);
      }
    });
  }
  test("aprobar rechaza avisos activos antes de actualizar", async () => {
    reset(); activeFlag = true;
    assert.equal((await approvePayrollPeriod({ id_period: 1 })).ok, false);
    assert.equal(queries.length, 1); assert.equal(rolledBack, 1);
  });
  test("pagar rechaza empleados faltantes antes de actualizar", async () => {
    reset(); missing = true;
    assert.equal((await payPayrollPeriod({ id_period: 1 })).ok, false);
    assert.equal(queries.length, 1); assert.equal(rolledBack, 1);
  });
}
void main();
