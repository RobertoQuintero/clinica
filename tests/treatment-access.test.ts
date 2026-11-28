import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";

process.env.JWT_SECRET_SEED = "treatment-test-secret";
const secret = new TextEncoder().encode(process.env.JWT_SECRET_SEED);
let token: string | undefined;
let user: { id_user: number; id_empresa: number; id_role: number; sucursales_string: string; status: number; deleted_at: string | null } | undefined;
let treatment: { id_paciente: number; id_empresa: number; id_sucursal: number; id_especialista: number } | undefined;
let parentId: number | undefined;
let consultation: { id_empresa: number; id_sucursal: number; id_tratamiento: number } | undefined;
let podologoBranches: string | undefined;
let failQuery = false;
let authCalls = 0;
let businessCalls: { sql: string; params?: Record<string, unknown> }[] = [];
let consumptionCalls = 0;

mock.module("next/headers", { namedExports: { cookies: async () => ({ get: () => token ? { value: token } : undefined }) } });
mock.module("@/database/connection", { defaultExport: {
  queryParams: async (sql: string, params?: Record<string, unknown>) => {
    if (sql.includes("FROM [CentroPodologico].[dbo].[users]") && params?.id_podologo !== undefined) {
      businessCalls.push({ sql, params });
      return podologoBranches === undefined ? [] : [{ sucursales_string: podologoBranches }];
    }
    if (sql.includes("FROM [CentroPodologico].[dbo].[users]")) {
      authCalls++;
      assert.match(sql, /\[status\]\s*=\s*1/i);
      assert.match(sql, /\[deleted_at\]\s+IS\s+NULL/i);
      if (failQuery) throw new Error("database unavailable");
      return user && user.id_user === params?.id_user && user.status === 1 && user.deleted_at === null ? [user] : [];
    }
    businessCalls.push({ sql, params });
    if (sql.includes("SELECT c.[id_paciente], c.[id_empresa], c.[id_sucursal], t.[id_especialista]")) return treatment && params?.id_tratamiento === 1 ? [treatment] : [];
    if (sql.includes("SELECT [id_tratamiento] FROM [CentroPodologico].[dbo].[Tratamiento_onicomicosis_pagos]")) return parentId === undefined ? [] : [{ id_tratamiento: parentId }];
    if (sql.includes("SELECT [id_tabla_referencia], [id_egreso_stage]")) return parentId === undefined ? [] : [{ id_tabla_referencia: parentId, id_egreso_stage: 1 }];
    if (sql.includes("SELECT c.[id_empresa], c.[id_sucursal], t.[id_tratamiento]")) return consultation ? [consultation] : [];
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
    updateTratamientoStage: () => actions.updateTratamientoStage(1, 4),
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
    token = valid; user = { id_user: 2, id_empresa: 7, id_role: 1, sucursales_string: "1,2", status: 1, deleted_at: null };
    treatment = { id_paciente: 8, id_empresa: 7, id_sucursal: 1, id_especialista: 2 };
    parentId = 1; consultation = { id_empresa: 7, id_sucursal: 1, id_tratamiento: 1 }; podologoBranches = "1";
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
      if (name === "createPagoTratamiento") assert.ok(businessCalls.some(call => call.params?.id_usuario === 2));
      if (name === "createEgreso") assert.ok(businessCalls.some(call => call.params?.id_user_capturo === 2));
      if (name === "deleteEgreso") assert.ok(businessCalls.some(call => call.params?.id_user_elimino === 2));
      if (name === "createConsultaOnicomicosis") assert.equal(consumptionCalls, 1);
    }
    reset();
    await actions.getTratamientos(1);
    user!.status = 0;
    await assert.rejects(() => actions.getTratamientos(1));
    assert.equal(authCalls, 2);
  });
  test("empresa, sucursales y especialista se validan con datos vigentes", async () => {
    for (const setup of [
      () => { user!.sucursales_string = "0,abc,-1,1.5"; },
      () => { treatment!.id_empresa = 8; },
      () => { treatment!.id_sucursal = 3; },
      () => { user!.id_role = 5; treatment!.id_especialista = 3; },
      () => { treatment = undefined; },
    ]) {
      reset(); setup();
      await assert.rejects(() => actions.getTratamiento(1));
      assert.ok(!businessCalls.some(call => call.sql.includes("t.[peso]")));
    }
    reset();
    await actions.getTratamiento(1);
    user!.sucursales_string = "2";
    await assert.rejects(() => actions.getTratamiento(1));
    await assert.rejects(() => actions.getTratamientos(1));
  });
  test("listado y búsqueda fuerzan especialista del médico externo", async () => {
    for (const supplied of [undefined, 999]) {
      reset(); user!.id_role = 5;
      await actions.getTratamientos(1, supplied);
      await actions.searchTratamientos(1, "x", supplied);
      for (const call of businessCalls) {
        assert.equal(call.params?.id_especialista, 2);
        assert.equal(call.params?.id_empresa, 7);
        assert.match(call.sql, /t\.\[id_especialista\]\s*=\s*@id_especialista/);
      }
    }
  });
  test("recursos hijos requieren un tratamiento padre accesible", async () => {
    const originalError = console.error; console.error = () => {};
    try {
      for (const parent of [undefined, 99]) {
        reset(); parentId = parent;
        await assert.rejects(() => actions.getArchivosByEgreso(1));
        assert.equal((await actions.deleteEgreso(1)).ok, false);
        assert.equal((await actions.deletePagoTratamiento(1)).ok, false);
      }
      reset(); treatment!.id_empresa = 8;
      await assert.rejects(() => actions.getRecetasByTratamiento(1));
      await assert.rejects(() => actions.getEgresosByTratamiento(1));
      assert.equal((await actions.saveRecetaTratamiento(form)).ok, false);
    } finally { console.error = originalError; }
  });
  test("rol externo lee egresos propios y no modifica egresos ni accede a pagos", async () => {
    const originalError = console.error; console.error = () => {};
    try {
      reset(); user!.id_role = 5;
      await actions.getEgresosByTratamiento(1);
      await actions.getArchivosByEgreso(1);
      await assert.rejects(() => actions.getPagosByTratamiento(1));
      await assert.rejects(() => actions.hasPagoTipo2(1));
      for (const call of [calls.createPagoTratamiento, calls.updatePagoTratamiento, calls.deletePagoTratamiento, calls.createEgreso, calls.updateEgreso, calls.deleteEgreso, calls.saveEgresoArchivo]) {
        assert.equal((await call() as { ok: boolean }).ok, false);
      }
      assert.equal((await actions.saveRecetaTratamiento(form)).ok, true);
      await actions.updateTratamientoStage(1, 2);
      await assert.rejects(() => actions.updateTratamientoStage(1, 4));
    } finally { console.error = originalError; }
  });
  test("operaciones internas respetan la matriz de roles y etapa de egreso", async () => {
    const originalError = console.error; console.error = () => {};
    try {
      for (const role of [1, 4, 2, 5]) {
        reset(); user!.id_role = role;
        const authorized = [1, 4].includes(role);
        assert.equal((await actions.createEgreso(form)).ok, authorized);
        assert.equal((await actions.deletePagoTratamiento(1)).ok, authorized);
        assert.equal((await actions.updateEgreso({ ...form, id_egreso_stage: 2 })).ok, authorized);
        assert.equal((await actions.saveRecetaTratamiento(form)).ok, [1, 4, 5].includes(role));
        assert.equal((await actions.updateEgreso(form)).ok, role !== 5);
      }
    } finally { console.error = originalError; }
  });
  test("consultas históricas y archivos exigen empresa y sucursal propias", async () => {
    reset(); await actions.getConsultasByTratamiento(1);
    const query = businessCalls.at(-1)!;
    assert.match(query.sql, /c\.\[id_empresa\]\s*=\s*@id_empresa/);
    assert.match(query.sql, /c\.\[id_sucursal\]\s+IN\s*\(@sucursal0, @sucursal1\)/);
    assert.equal(query.params?.sucursal0, 1); assert.equal(query.params?.sucursal1, 2);
    for (const value of [undefined, { id_empresa: 8, id_sucursal: 1, id_tratamiento: 1 }, { id_empresa: 7, id_sucursal: 3, id_tratamiento: 1 }, { id_empresa: 7, id_sucursal: 1, id_tratamiento: 99 }]) {
      reset(); consultation = value;
      await assert.rejects(() => actions.getArchivosByConsulta(1));
    }
    reset(); await actions.getArchivosByConsulta(1);
  });
  test("creación de consulta deriva datos de origen y valida la asignación del podólogo", async () => {
    const originalError = console.error; console.error = () => {};
    try {
      reset();
      assert.equal((await actions.createConsultaOnicomicosis({ ...form, id_paciente: 999, id_empresa: 999, id_sucursal: 999 })).ok, true);
      const insert = businessCalls.find(call => call.sql.includes("INSERT INTO [CentroPodologico].[dbo].[consultas]"))!;
      assert.equal(insert.params?.id_paciente, 8); assert.equal(insert.params?.id_empresa, 7); assert.equal(insert.params?.id_sucursal, 1);
      const podologoQuery = businessCalls.find(call => call.params?.id_podologo === 1 && call.sql.includes("FROM [CentroPodologico].[dbo].[users]"))!;
      assert.equal(podologoQuery.params?.id_empresa, 7);
      assert.match(podologoQuery.sql, /\[status\]\s*=\s*1/);
      for (const branches of [undefined, "2", "11,abc"]) {
        reset(); podologoBranches = branches;
        assert.equal((await actions.createConsultaOnicomicosis(form)).ok, false);
        assert.equal(consumptionCalls, 0);
        assert.ok(!businessCalls.some(call => call.sql.includes("INSERT INTO [CentroPodologico].[dbo].[consultas]")));
      }
    } finally { console.error = originalError; }
  });
}
void main();
