/** SDI fijo con prestaciones mínimas; las fechas son días civiles YYYY-MM-DD. */
export type SdiCalculationResult =
  | { ok: false; motivo: string }
  | {
      ok: true;
      salarioDiarioFiscal: number;
      fechaIngreso: string;
      fechaReferencia: string;
      antiguedadAnios: number;
      diasVacaciones: number;
      diasAguinaldo: number;
      porcentajePrimaVacacional: number;
      factorIntegracion: number;
      salarioDiarioIntegrado: number;
    };

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function calculateSdi(
  salarioDiarioFiscal: number | null,
  fechaIngreso: string | null,
  fechaReferencia: string | null,
): SdiCalculationResult {
  if (salarioDiarioFiscal == null || !Number.isFinite(salarioDiarioFiscal) || salarioDiarioFiscal <= 0
      || salarioDiarioFiscal > 9999999999.99 || Math.abs(salarioDiarioFiscal * 100 - Math.round(salarioDiarioFiscal * 100)) > 0.0001) {
    return { ok: false, motivo: "Falta un salario diario fiscal válido del periodo." };
  }
  if (!fechaIngreso || !isValidDate(fechaIngreso)) {
    return { ok: false, motivo: "Falta una fecha de ingreso válida." };
  }
  if (!fechaReferencia || !isValidDate(fechaReferencia)) {
    return { ok: false, motivo: "Falta una fecha de cierre de periodo válida." };
  }
  if (fechaIngreso > fechaReferencia) {
    return { ok: false, motivo: "La fecha de ingreso es posterior al cierre del periodo." };
  }

  const [hireYear, hireMonth, hireDay] = fechaIngreso.split("-").map(Number);
  const [referenceYear, referenceMonth, referenceDay] = fechaReferencia.split("-").map(Number);
  // Como DATEADD(YEAR, ...) en la sincronización de vacaciones: 29 de febrero
  // cumple aniversario el 28 de febrero en años no bisiestos.
  const leapYear = referenceYear % 4 === 0 && (referenceYear % 100 !== 0 || referenceYear % 400 === 0);
  const anniversaryDay = hireMonth === 2 && hireDay === 29 && !leapYear ? 28 : hireDay;
  const anniversaryPassed = referenceMonth > hireMonth || (referenceMonth === hireMonth && referenceDay >= anniversaryDay);
  const antiguedadAnios = referenceYear - hireYear - (anniversaryPassed ? 0 : 1);
  const diasVacaciones = antiguedadAnios < 5
    ? 12 + antiguedadAnios * 2
    : 20 + Math.floor(antiguedadAnios / 5) * 2;
  const diasAguinaldo = 15;
  const porcentajePrimaVacacional = 25;
  const factorIntegracion = 1 + (diasAguinaldo + diasVacaciones * 0.25) / 365;
  // Factor exacto = (1520 + días de vacaciones) / 1460. Se redondea
  // únicamente el resultado final, trabajando con centavos enteros.
  const salaryCents = Math.round(salarioDiarioFiscal * 100);
  const salarioDiarioIntegrado = Math.floor((salaryCents * (1520 + diasVacaciones) + 730) / 1460) / 100;
  if (salarioDiarioIntegrado > 9999999999.99) {
    return { ok: false, motivo: "El salario diario integrado excede el máximo permitido." };
  }

  return { ok: true, salarioDiarioFiscal, fechaIngreso, fechaReferencia, antiguedadAnios,
    diasVacaciones, diasAguinaldo, porcentajePrimaVacacional, factorIntegracion, salarioDiarioIntegrado };
}
