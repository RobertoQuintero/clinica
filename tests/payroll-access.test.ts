import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";

process.env.JWT_SECRET_SEED = "payroll-test-secret";
const secret = new TextEncoder().encode(process.env.JWT_SECRET_SEED);
let token: string | undefined;
let selected: string | undefined;
let user: { id_user: number; id_role: number; id_empresa: number; id_sucursal: number; status: boolean; deleted_at: string | null } | undefined;
let branches: { id_sucursal: number; id_empresa: number; status: number }[] = [];
let failQuery = false;
let failBranchQuery = false;
let receiptCalls = 0;
let providerCalls = 0;

mock.module("next/headers", { namedExports: { cookies: async () => ({ get: (name: string) => {
  const value = name === "auth_token" ? token : selected;
  return value === undefined ? undefined : { value };
} }) } });
mock.module("@/database/connection", { defaultExport: { queryParams: async (sql: string, params: Record<string, number>) => {
  if (failQuery) throw new Error("database unavailable");
  if (sql.includes("dbo.users")) return user?.status && user.deleted_at === null ? [user] : [];
  if (failBranchQuery) throw new Error("branch query failed");
  return branches.filter(b => b.id_sucursal === params.id_sucursal && b.id_empresa === params.id_empresa && b.status === 1);
} } });
mock.module("@/lib/payroll/cfdi/payrollCfdiRepository", { namedExports: {
  loadPayrollCfdiReceiptForDownload: async () => { receiptCalls++; return null; },
} });
mock.module("@/lib/billing/facturapiClient", { namedExports: {
  getOrgClientForStoredMode: async () => { providerCalls++; throw new Error("unexpected provider call"); },
} });

async function main() {
const { assertPayrollAccess, getCurrentPayrollUser } = await import("../lib/payroll/access");
const routes = await Promise.all([
  import("../app/api/nomina/cfdi/[id]/xml/route"),
  import("../app/api/nomina/cfdi/[id]/pdf/route"),
  import("../app/api/nomina/cfdi/[id]/acuse/route"),
]);
const validToken = await new SignJWT({ id_user: 2, id_role: 4, id_empresa: 99 })
  .setProtectedHeader({ alg: "HS256" }).sign(secret);

function reset() {
  token = validToken;
  selected = undefined;
  user = { id_user: 2, id_role: 4, id_empresa: 1, id_sucursal: 1, status: true, deleted_at: null };
  branches = [{ id_sucursal: 1, id_empresa: 1, status: 1 }, { id_sucursal: 2, id_empresa: 1, status: 1 }];
  failQuery = false;
  failBranchQuery = false;
  receiptCalls = 0;
  providerCalls = 0;
}

test("JWT inválido y permisos revocados con el mismo token", async () => {
  reset(); token = "invalid";
  assert.equal((await getCurrentPayrollUser()).ok, false);
  token = validToken;
  assert.deepEqual(await getCurrentPayrollUser(), { ok: true, data: { id_user: 2, id_empresa: 1, id_sucursal: 1 } });
  user!.id_role = 2;
  assert.equal((await getCurrentPayrollUser()).ok, false);
  user!.id_role = 4;
  user!.status = false;
  assert.equal((await getCurrentPayrollUser()).ok, false);
  user!.status = true;
  user!.deleted_at = "2026-01-01";
  assert.equal((await getCurrentPayrollUser()).ok, false);
  user = undefined;
  assert.equal((await getCurrentPayrollUser()).ok, false);
});

test("selección, respaldo y errores de consulta deniegan acceso cuando corresponde", async () => {
  reset(); selected = "2";
  const selectedResult = await assertPayrollAccess();
  assert.equal(selectedResult.ok && selectedResult.data.id_sucursal, 2);
  branches.push({ id_sucursal: 3, id_empresa: 2, status: 1 }, { id_sucursal: 4, id_empresa: 1, status: 0 });
  for (const value of ["3", "4", "2.5", "-1", "", "999"]) {
    selected = value;
    const result = await assertPayrollAccess();
    assert.equal(result.ok && result.data.id_sucursal, 1);
  }
  selected = undefined;
  assert.equal((await assertPayrollAccess()).ok, true);
  branches = [];
  assert.equal((await assertPayrollAccess()).ok, false);
  failBranchQuery = true;
  assert.equal((await assertPayrollAccess()).ok, false);
  failQuery = true;
  assert.equal((await assertPayrollAccess()).ok, false);
});
test("las tres descargas rechazan usuarios revocados antes de consultar recibos o proveedor", async () => {
  reset(); user!.id_role = 2;
  for (const route of routes) {
    const response = await route.GET(new Request("http://localhost"), { params: Promise.resolve({ id: "1" }) });
    assert.equal(response.status, 401);
  }
  assert.equal(receiptCalls, 0);
  assert.equal(providerCalls, 0);
});
}

void main();
