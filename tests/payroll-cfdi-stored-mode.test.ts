import test, { mock } from "node:test";
import assert from "node:assert/strict";
import * as facturapiExports from "facturapi";

let livemode = false;
let currentMode = true;
let missingMode: string | null = null;
let estado = "C";
const keyRequests: string[] = [];
const providerCalls: { key: string; operation: string; id: string }[] = [];

const receipt = () => ({
  id_period_employee_cfdi: 1, org_uid: "issuer", livemode, estado,
  facturapi_id: "invoice", folio: 123, id_empleado: 7, id_period: 8,
  cancelacion_solicitada_at: "2026-11-27", uuid: "uuid",
});

mock.module("@/lib/payroll/access", { namedExports: {
  getCurrentPayrollUser: async () => ({ ok: true, data: { id_empresa: 1, id_user: 2, id_sucursal: 3 } }),
  assertPayrollAccess: async () => ({ ok: true, data: { id_empresa: 1, id_user: 2, id_sucursal: 3 } }),
} });
mock.module("@/database/connection", { defaultExport: {
  transaction: async (fn: (tx: object) => unknown) => fn({}),
} });
mock.module("@/lib/billing/organizationsRepository", { namedExports: {
  getOrganizationByUid: async () => ({ is_live: currentMode }),
  getOrganizationKey: async (_db: unknown, uid: string, company: number, mode: string) => {
    assert.equal(uid, "issuer"); assert.equal(company, 1);
    keyRequests.push(mode);
    return mode === missingMode ? null : `${mode}-key`;
  },
} });
const facturapiNamedExports = Object.fromEntries(Object.entries(facturapiExports).filter(([name]) => name !== "default"));
class FakeFacturapi {
  invoices: Record<string, (id: string) => Promise<unknown>>;
  constructor(key: string) {
    const call = (operation: string) => async (id: string) => {
      providerCalls.push({ key, operation, id });
      return operation.startsWith("download") ? new Blob([operation]) : { status: "pending" };
    };
    this.invoices = Object.fromEntries(["downloadXml", "downloadPdf", "downloadCancellationReceiptXml", "cancel", "retrieve"].map(op => [op, call(op)]));
  }
}
Object.assign(FakeFacturapi, facturapiNamedExports);
mock.module("facturapi", { defaultExport: FakeFacturapi });
mock.module("@/lib/payroll/cfdi/payrollCfdiRepository", { namedExports: {
  loadPayrollCfdiReceiptForDownload: async () => ({ receipt: receipt(), codigoEmpleado: "EMP" }),
  reservePayrollCancellation: async () => ({ status: "reserved", receipt: receipt() }),
} });
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });

async function main() {
  const routes = await Promise.all([
    import("../app/api/nomina/cfdi/[id]/xml/route"),
    import("../app/api/nomina/cfdi/[id]/pdf/route"),
    import("../app/api/nomina/cfdi/[id]/acuse/route"),
  ]);
  const { cancelPayrollReceipt, refreshPayrollCancellationStatus } = await import("../app/dashboard/nomina/procesar/actions");
  const operations = ["downloadXml", "downloadPdf", "downloadCancellationReceiptXml"];
  const reset = (mode: boolean) => {
    livemode = mode; currentMode = !mode; missingMode = null; estado = "C";
    keyRequests.length = 0; providerCalls.length = 0;
  };

  test("las tres descargas usan la clave del recibo aunque el emisor haya cambiado de modo", async () => {
    for (const mode of [false, true]) for (const [index, route] of routes.entries()) {
      reset(mode);
      const response = await route.GET(new Request("http://localhost"), { params: Promise.resolve({ id: "1" }) });
      const expected = mode ? "live" : "test";
      assert.equal(response.status, 200);
      assert.equal(await response.text(), operations[index]);
      assert.deepEqual(keyRequests, [expected]);
      assert.deepEqual(providerCalls, [{ key: `${expected}-key`, operation: operations[index], id: "invoice" }]);
    }
  });

  test("si falta la clave del recibo, cada descarga la identifica sin usar la otra", async () => {
    for (const mode of [false, true]) for (const route of routes) {
      reset(mode); missingMode = mode ? "live" : "test";
      const response = await route.GET(new Request("http://localhost"), { params: Promise.resolve({ id: "1" }) });
      assert.equal(response.status, 400);
      assert.match((await response.json()).message, mode ? /clave Live/ : /clave Test/);
      assert.deepEqual(keyRequests, [missingMode]);
      assert.deepEqual(providerCalls, []);
    }
  });

  test("cancelación y consulta de estado usan el modo guardado", async () => {
    for (const mode of [false, true]) {
      reset(mode); estado = "T";
      await cancelPayrollReceipt({ idReceipt: 1, motive: "02", confirmFolio: "NOM-123" });
      assert.deepEqual(keyRequests, [mode ? "live" : "test"]);
      assert.equal(providerCalls[0]?.operation, "cancel");
      assert.equal(providerCalls[0]?.key, `${mode ? "live" : "test"}-key`);
      reset(mode); estado = "X";
      await refreshPayrollCancellationStatus({ idReceipt: 1 });
      assert.deepEqual(keyRequests, [mode ? "live" : "test"]);
      assert.equal(providerCalls[0]?.operation, "retrieve");
      assert.equal(providerCalls[0]?.key, `${mode ? "live" : "test"}-key`);
    }
  });
}

void main();
