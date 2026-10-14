import type { IVacationBlockRow } from "@/lib/payroll/incidentSources";

/** id_empleado -> conjunto de fechas "YYYY-MM-DD" de vacaciones, recortado al rango del periodo. */
export function buildVacationDatesByEmployee(
  blocks: IVacationBlockRow[],
  rangeStart: string,
  rangeEnd: string,
): Map<number, Set<string>> {
  const vacationDatesByEmployee = new Map<number, Set<string>>();

  for (const block of blocks) {
    const blockStart = block.fecha_inicio > rangeStart ? block.fecha_inicio : rangeStart;
    const blockEnd = block.fecha_fin < rangeEnd ? block.fecha_fin : rangeEnd;
    if (blockStart > blockEnd) continue;

    const vacationDates = vacationDatesByEmployee.get(block.id_empleado) ?? new Set<string>();
    // Se recorre en UTC solo para sumar días de calendario sobre strings "YYYY-MM-DD"; no se serializa ningún Date.
    const cursor = new Date(`${blockStart}T00:00:00Z`);
    const lastDay = new Date(`${blockEnd}T00:00:00Z`);
    while (cursor <= lastDay) {
      vacationDates.add(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    vacationDatesByEmployee.set(block.id_empleado, vacationDates);
  }

  return vacationDatesByEmployee;
}
