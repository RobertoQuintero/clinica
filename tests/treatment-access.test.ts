import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";

process.env.JWT_SECRET_SEED = "treatment-test-secret";
const secret = new TextEncoder().encode(process.env.JWT_SECRET_SEED);
let token: string | undefined;
let user: { id_user: number; id_empresa: number; status: number; deleted_at: string | null } | undefined;
let failQuery = false;
let authCalls = 0;
let businessCalls: { sql: string; params?: Record<string, unknown> }[] = [];
let consumptionCalls = 0;

mock.module("next/headers", { namedExports: { cookies: async () => ({ get: () => token ? { value: token } : undefined }) } });
mock.module("@/database/connection", { defaultExport: {
  queryParams: async (sql: string, params?: Record<string, unknown>) => {
    if (sql.includes("FROM [CentroPodologico].[dbo].[users]")) {
      authCalls++;
      assert.match(sql, /\[status\]\s*=\s*1/i);
      assert.match(sql, /\[deleted_at\]\s+IS\s+NULL/i);
      if (failQuery) throw new Error("database unavailable");
      return user && user.id_user === params?.id_user && user.status === 1 && user.deleted_at === null ? [user] : [];
    }
    businessCalls.push({ sql, params });
    if (sql.includes("INSERT INTO [CentroPodologico].[dbo].[consultas]")) return [{ id_consulta: 42 }];
    if (sql.includes("INSERT INTO [CentroPodologico].[dbo].[archivos]")) return [{ id_archivo: 1 }];
    if (sql.includes("INSERT INTO [CentroPodologico].[dbo].[Egresos_archivos]")) return [{ id_egreso_archivo: 1 }];
    return [];
  },
  query: async (sql: string) => { businessCalls.push({ sql }); return []; },
} });
mock.module("@/lib/inventory/consultationConsumption", { namedExports: {
  applyConsultationConsumption: async () => { consumptionCalls++; },
} });

async function main() {
  const actions = await import("../app/dashboard/tratamientos/actions");
  const form = { id_tratamiento: 1, id_tratamiento_pago: 1, id_paciente: 1, id_podologo: 1, id_sucursal: 1, id_empresa: 1, diagnostico: "", tratamiento_aplicado: "", observaciones: "", costo_total: 1, total: 1, idMetodoPago: 1, referencia: "", ruta: "", tipo: "", created_at: "2026-01-01", id_egreso: 1, id_egreso_tipo: 1, iva_bit: 0, iva: 0, monto: 1, id_egreso_stage: 1, url: "", id_user: 1 };
  const calls = {
    getTratamientos: () => actions.getTratamientos(1),
    searchTratamientos: () => actions.searchTratamientos(1, "x"),
    getTratamiento: () => actions.getTratamiento(1),
    getTratamientoDetalle: () => actions.getTratamientoDetalle(1),
    markTratamientoRevisado: () => actions.markTratamientoRevisado(1),
    updateTratamientoStage: () => actions.updateTratamientoStage(1, 2),
    getArchivosByConsulta: () => actions.getArchivosByConsulta(1),
    getPagosByTratamiento: () => actions.getPagosByTratamiento(1),
    getDefaultTotalTipo1: () => actions.getDefaultTotalTipo1(),
    getDefaultTotalTipo2: () => actions.getDefaultTotalTipo2(),
    getMetodosPagoTratamiento: () => actions.getMetodosPagoTratamiento(),
    createPagoTratamiento: () => actions.createPagoTratamiento(form),
    hasPagoTipo2: () => actions.hasPagoTipo2(1),
    deletePagoTratamiento: () => actions.deletePagoTratamiento(1),
    updatePagoTratamiento: () => actions.updatePagoTratamiento(form),
    getRecetasByTratamiento: () => actions.getRecetasByTratamiento(1),
    saveRecetaTratamiento: () => actions.saveRecetaTratamiento(form),
    getEgresosByTratamiento: () => actions.getEgresosByTratamiento(1),
    getEgresoTipos: () => actions.getEgresoTipos(),
    getEgresoStages: () => actions.getEgresoStages(),
    createEgreso: () => actions.createEgreso(form),
    updateEgreso: () => actions.updateEgreso(form),
    deleteEgreso: () => actions.deleteEgreso(1),
    getArchivosByEgreso: () => actions.getArchivosByEgreso(1),
    saveEgresoArchivo: () => actions.saveEgresoArchivo(form),
    getConsultasByTratamiento: () => actions.getConsultasByTratamiento(1),
    createConsultaOnicomicosis: () => actions.createConsultaOnicomicosis(form),
  };
  assert.deepEqual(Object.keys(calls).sort(), Object.keys(actions).sort());
  const writes = new Set(["createPagoTratamiento", "deletePagoTratamiento", "updatePagoTratamiento", "saveRecetaTratamiento", "createEgreso", "updateEgreso", "deleteEgreso", "saveEgresoArchivo", "createConsultaOnicomicosis"]);
  const sign = (payload: Record<string, unknown>, expired = false) => {
    const jwt = new SignJWT(payload).setProtectedHeader({ alg: "HS256" });
    if (expired) jwt.setExpirationTime("1 second ago");
    return jwt.sign(secret);
  };
  const valid = await sign({ id_user: 2, id_empresa: 999 });
  const expired = await sign({ id_user: 2 }, true);
  const invalidIds = await Promise.all([0, -1, 1.5, "2", null, Number.MAX_SAFE_INTEGER + 1].map(id_user => sign({ id_user })));
  function reset() {
    token = valid; user = { id_user: 2, id_empresa: 7, status: 1, deleted_at: null };
    failQuery = false; authCalls = 0; businessCalls = []; consumptionCalls = 0;
  }
  const scenarios: [string, () => void, number][] = [
    ["sin cookie", () => { token = undefined; }, 0],
    ["JWT inválido", () => { token = "invalid"; }, 0],
    ["JWT vencido", () => { token = expired; }, 0],
    ...invalidIds.map((invalid, index): [string, () => void, number] => [`identidad inválida ${index}`, () => { token = invalid; }, 0]),
    ["usuario inexistente", () => { user = undefined; }, 1],
    ["usuario inactivo", () => { user!.status = 0; }, 1],
    ["usuario eliminado", () => { user!.deleted_at = "2026-01-01"; }, 1],
    ["fallo de consulta", () => { failQuery = true; }, 1],
  ];
  test("las 27 acciones rechazan sesiones inválidas antes de operaciones de negocio", async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      for (const [scenario, setup, expectedAuthCalls] of scenarios) {
        for (const [name, call] of Object.entries(calls)) {
          reset(); setup();
          if (writes.has(name)) {
            const result = await call();
            assert.equal((result as { ok: boolean }).ok, false, `${scenario}: ${name}`);
            assert.equal(typeof (result as { message: unknown }).message, "string");
          } else {
            await assert.rejects(call, `${scenario}: ${name}`);
          }
          assert.equal(authCalls, expectedAuthCalls, `${scenario}: ${name}`);
          assert.equal(businessCalls.length, 0, `${scenario}: ${name}`);
          assert.equal(consumptionCalls, 0, `${scenario}: ${name}`);
        }
      }
    } finally { console.error = originalError; }
  });
  test("sesiones válidas consultan vigencia en cada acción y conservan sus contratos", async () => {
    for (const [name, call] of Object.entries(calls)) {
      reset();
      const result = await call();
      assert.equal(authCalls, 1, name);
      assert.ok(businessCalls.length > 0, name);
      if (writes.has(name)) assert.equal((result as { ok: boolean }).ok, true, name);
      if (name === "markTratamientoRevisado" || name === "updateTratamientoStage") assert.equal(result, undefined);
      if (name === "getTratamientos" || name === "searchTratamientos") assert.equal(businessCalls[0].params?.id_empresa, 7);
      if (name === "createPagoTratamiento") assert.equal(businessCalls[0].params?.id_usuario, 2);
      if (name === "createEgreso") assert.equal(businessCalls[0].params?.id_user_capturo, 2);
      if (name === "deleteEgreso") assert.equal(businessCalls[0].params?.id_user_elimino, 2);
      if (name === "createConsultaOnicomicosis") assert.equal(consumptionCalls, 1);
    }
    reset();
    await actions.getTratamientos(1);
    user!.status = 0;
    await assert.rejects(() => actions.getTratamientos(1));
    assert.equal(authCalls, 2);
  });
}
void main();
