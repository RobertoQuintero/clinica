import type { IEconomicDayRow, IVacationBlockRow } from "@/lib/payroll/incidentSources";
import { buildVacationDatesByEmployee } from "@/lib/payroll/vacationExclusion";

/** id_empleado -> fechas "YYYY-MM-DD" de días económicos activos (el SQL ya las recorta al periodo). */
export function buildEconomicDayDatesByEmployee(rows: IEconomicDayRow[]): Map<number, Set<string>> {
  const economicDatesByEmployee = new Map<number, Set<string>>();

  for (const row of rows) {
    const economicDates = economicDatesByEmployee.get(row.id_empleado) ?? new Set<string>();
    economicDates.add(row.fecha);
    economicDatesByEmployee.set(row.id_empleado, economicDates);
  }

  return economicDatesByEmployee;
}

/** id_empleado -> unión de fechas de vacaciones y días económicos, recortada al rango. Para Retardos y Bonos. */
export function buildPaidLeaveDatesByEmployee(
  vacationBlocks: IVacationBlockRow[],
  economicDays: IEconomicDayRow[],
  rangeStart: string,
  rangeEnd: string,
): Map<number, Set<string>> {
  const paidLeaveDatesByEmployee = buildVacationDatesByEmployee(vacationBlocks, rangeStart, rangeEnd);

  for (const [idEmpleado, economicDates] of buildEconomicDayDatesByEmployee(economicDays)) {
    const paidLeaveDates = paidLeaveDatesByEmployee.get(idEmpleado) ?? new Set<string>();
    for (const economicDate of economicDates) paidLeaveDates.add(economicDate);
    paidLeaveDatesByEmployee.set(idEmpleado, paidLeaveDates);
  }

  return paidLeaveDatesByEmployee;
}
