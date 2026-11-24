import test from "node:test";
import assert from "node:assert/strict";
import { calculateSdi } from "../lib/payroll/sdiCalculation";
import { buildPayrollCfdiPayload, type PayrollCfdiSource } from "../lib/payroll/cfdi/payrollCfdiPayload";

test("SDI applies vacation bands on anniversaries, including leap-day hires", () => {
  for (const [hire, end, years, days] of [
    ["2024-03-01", "2025-02-28", 0, 12],
    ["2024-03-01", "2025-03-01", 1, 14],
    ["2020-03-01", "2025-03-01", 5, 22],
    ["2015-03-01", "2025-03-01", 10, 24],
    ["2024-02-29", "2025-02-27", 0, 12],
    ["2024-02-29", "2025-02-28", 1, 14],
  ] as const) {
    const result = calculateSdi(100, hire, end);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.antiguedadAnios, years);
      assert.equal(result.diasVacaciones, days);
    }
  }
});

test("SDI covers vacation-band transitions before and on each anniversary", () => {
  for (const [years, previousDays, days] of [
    [1, 12, 14], [2, 14, 16], [3, 16, 18], [4, 18, 20],
    [5, 20, 22], [10, 22, 24], [15, 24, 26], [20, 26, 28],
    [25, 28, 30], [30, 30, 32],
  ] as const) {
    const hire = `${2025 - years}-03-01`;
    const before = calculateSdi(100, hire, "2025-02-28");
    const on = calculateSdi(100, hire, "2025-03-01");
    assert.equal(before.ok && before.diasVacaciones, previousDays);
    assert.equal(on.ok && on.diasVacaciones, days);
  }
});

test("SDI rounds only the final amount and rejects missing or invalid data", () => {
  const result = calculateSdi(100.01, "2025-01-01", "2025-01-01");
  assert.equal(result.ok && result.salarioDiarioIntegrado, 104.94);
  for (const args of [
    [null, "2025-01-01", "2025-01-01"],
    [100, null, "2025-01-01"],
    [100, "2025-01-01", null],
    [100, "2025-01-02", "2025-01-01"],
    [100, "2025-02-29", "2025-03-01"],
  ] as const) {
    const invalid = calculateSdi(args[0], args[1], args[2]);
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.ok(invalid.motivo);
  }
});

test("provider payload keeps stored SDI independent from SBC", () => {
  const source: PayrollCfdiSource = {
    fechaPago: "2025-01-07", fechaInicialPago: "2025-01-01", fechaFinalPago: "2025-01-07",
    numDiasPagados: 7, emisor: { registroPatronal: "A", curp: null },
    receptor: {
      rfc: "XAXX010101000", curp: null, nss: null, codigoPostalFiscal: "01000",
      nombreCompleto: "Persona Ejemplo", tipoRegimen: "02", tipoContrato: "01", tipoJornada: null,
      bancoClave: null, cuentaBancaria: null, claveEntFed: "CMX", periodicidadPagoClaveSat: "02",
      riesgoPuesto: "1", numEmpleado: "1", puesto: null, fechaIngreso: "2024-01-01",
      salarioBaseCotApor: 300, salarioDiarioIntegrado: 104.94,
    },
    perceptions: [], overtimeDays: [], imssRetenido: 0, isrRetenido: 0,
    subsidioConDerecho: false, subsidioCausado: 0,
  };
  const payload = buildPayrollCfdiPayload(source) as { complements: { data: { receptor: Record<string, unknown> } }[] };
  assert.equal(payload.complements[0].data.receptor.salario_base_cot_apor, 300);
  assert.equal(payload.complements[0].data.receptor.salario_diario_integrado, 104.94);
});
