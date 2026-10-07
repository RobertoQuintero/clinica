import type { IPayrollEmployeeSnapshot } from "@/interfaces/payroll_calculation";
import { SHIFT_EXTENSION_HOURS_PER_DAY, SHIFT_EXTENSION_PAY_MULTIPLIER } from "@/lib/payroll/constants";
import { nextDate } from "@/lib/payroll/absenceDetection";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { weekdayOfDate } from "@/lib/payroll/overtimeDetection";

const WORKDAY_HOURS = 8;

export interface IShiftExtensionWorkedDaysInput {
  fechaInicio:           string;                // "YYYY-MM-DD", inicio del periodo
  fechaFin:              string;                // "YYYY-MM-DD", fin del periodo
  fechaIngreso:          string;                // "YYYY-MM-DD"
  scheduledIsoWeekdays:  Iterable<number>;      // días ISO (1 = lunes .. 7 = domingo) con horario
  checkInDates:          Iterable<string>;      // fechas "YYYY-MM-DD" con al menos una checada
}

export interface IShiftExtensionWorkedDays {
  scheduledDays: number;   // días con horario en el rango del empleado
  workedDays:    number;   // días con horario y al menos una checada
}

/**
 * Espejo puro del conteo de días que hace el SQL del cálculo (donde manda el SQL).
 * Un día cuenta como trabajado si cae en max(fechaInicio, fechaIngreso)..fechaFin, tiene horario para su
 * día ISO de la semana y tiene al menos una checada (una incompleta cuenta). Un día de descanso con checada
 * no cuenta, ni un día con horario sin checada, aunque esté justificado. Todas las fechas son strings y se
 * comparan como strings; los días futuros nunca tienen checada, así que no hace falta conocer "hoy".
 */
export function countShiftExtensionWorkedDays(input: IShiftExtensionWorkedDaysInput): IShiftExtensionWorkedDays {
  const { fechaInicio, fechaFin, fechaIngreso } = input;
  const scheduledWeekdays = new Set(input.scheduledIsoWeekdays);
  const datesWithCheckIn = new Set(input.checkInDates);
  const rangeStart = fechaIngreso > fechaInicio ? fechaIngreso : fechaInicio;

  let scheduledDays = 0;
  let workedDays = 0;
  for (let date = rangeStart; date <= fechaFin; date = nextDate(date)) {
    if (!scheduledWeekdays.has(weekdayOfDate(date))) continue;
    scheduledDays += 1;
    if (datesWithCheckIn.has(date)) workedDays += 1;
  }
  return { scheduledDays, workedDays };
}

/** Tarifa por día trabajado: salario_diario / 8 × 2. Sin redondear, para no acumular error de centavos. */
export function calculateShiftExtensionDailyRate(salarioDiario: number): number {
  return (salarioDiario * SHIFT_EXTENSION_PAY_MULTIPLIER * SHIFT_EXTENSION_HOURS_PER_DAY) / WORKDAY_HOURS;
}

/** Importe del bono: solo el total se redondea, a centavos. */
export function calculateShiftExtensionAmount(salarioDiario: number, workedDays: number): number {
  return Math.round(calculateShiftExtensionDailyRate(salarioDiario) * workedDays * 100) / 100;
}

export interface IShiftExtensionLineText {
  label:       string;   // "Bono por extensión de jornada"
  description: string;   // "12 días × $78.76"
  amount:      number;   // importe congelado en el snapshot
}

/**
 * Textos de la línea "Bono por extensión de jornada" del Detalle, a partir del snapshot. Devuelve null (la
 * línea se omite) si el empleado no está asignado o el importe es 0.
 */
export function describeShiftExtensionBonus(
  snapshot: Pick<
    IPayrollEmployeeSnapshot,
    "salario_diario" | "bono_extension_asignado" | "bono_extension_dias" | "importe_bono_extension"
  >,
): IShiftExtensionLineText | null {
  if (!snapshot.bono_extension_asignado || snapshot.importe_bono_extension <= 0) return null;

  const dayCount = snapshot.bono_extension_dias;
  const dailyRate = formatPayrollCurrency(calculateShiftExtensionDailyRate(snapshot.salario_diario));
  return {
    label: "Bono por extensión de jornada",
    description: `${dayCount === 1 ? "1 día" : `${dayCount} días`} × ${dailyRate}`,
    amount: snapshot.importe_bono_extension,
  };
}
