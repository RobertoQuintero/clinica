import { IPayrollEmployeeSnapshot, IPayrollPerceptionLine } from "@/interfaces/payroll_calculation";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

/** "2026-09-22" -> "22/09/2026". Opera sobre el string, sin pasar por `Date`. */
function formatDayMonthYear(dateString: string): string {
  const [year, month, day] = dateString.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatDays(days: number): string {
  return days === 1 ? "1 día" : `${days} días`;
}

/**
 * Líneas de la tarjeta "Percepciones totales" de un empleado. Hoy solo "Sueldo base";
 * los conceptos futuros (bonos, comisiones, …) se agregan aquí como nuevas líneas.
 * Las fechas son "YYYY-MM-DD" y se comparan como strings.
 */
export function buildPerceptionLines(
  snapshot: Pick<IPayrollEmployeeSnapshot, "salario_diario" | "dias" | "importe_salario">,
  fechaIngreso: string,
  fechaInicio: string,
): IPayrollPerceptionLine[] {
  const joinedDuringPeriod = fechaIngreso > fechaInicio;

  return [
    {
      key: "sueldo_base",
      label: "Sueldo base",
      description: `${formatDays(snapshot.dias)} × ${formatPayrollCurrency(snapshot.salario_diario)} diarios`,
      note: joinedDuringPeriod ? `Ingresó el ${formatDayMonthYear(fechaIngreso)}, proporcional` : null,
      amount: snapshot.importe_salario,
    },
  ];
}
