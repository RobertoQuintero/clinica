import { IPayrollEmployeeSnapshot, IPayrollPerceptionLine } from "@/interfaces/payroll_calculation";
import type { ICommissionTier } from "@/interfaces/payroll_commission";
import { findCommissionTier, formatTierRange } from "@/lib/payroll/commissionTiers";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { describeTreatmentCommission } from "@/lib/payroll/treatmentCommission";

/** "2026-09-22" -> "22/09/2026". Opera sobre el string, sin pasar por `Date`. */
function formatDayMonthYear(dateString: string): string {
  const [year, month, day] = dateString.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatDays(days: number): string {
  return days === 1 ? "1 día" : `${days} días`;
}

function formatConsultations(count: number): string {
  return count === 1 ? "1 consulta" : `${count} consultas`;
}

/**
 * Descripción de la comisión: el conteo congelado y, si el catálogo vivo todavía lo confirma,
 * el tramo. Si el tramo actual ya no paga lo mismo que el snapshot (alguien editó el catálogo
 * después de calcular), se omite el rango en lugar de mostrar uno que no explica el importe.
 */
function describeCommission(
  snapshot: Pick<IPayrollEmployeeSnapshot, "consultas_atendidas" | "importe_comision">,
  commissionTiers: ICommissionTier[],
): string {
  const consultations = formatConsultations(snapshot.consultas_atendidas);
  const appliedTier = findCommissionTier(commissionTiers, snapshot.consultas_atendidas);
  if (!appliedTier || appliedTier.importe !== snapshot.importe_comision) return consultations;
  return `${consultations} · tramo ${formatTierRange(appliedTier)}`;
}

/**
 * Líneas de la tarjeta "Percepciones totales" de un empleado: "Sueldo base" y, cuando el
 * snapshot trae importe, "Comisión por consultas atendidas" y "Comisión por tratamientos de onicomicosis".
 * Los conceptos futuros se agregan aquí.
 * Las fechas son "YYYY-MM-DD" y se comparan como strings.
 */
export function buildPerceptionLines(
  snapshot: Pick<
    IPayrollEmployeeSnapshot,
    | "salario_diario"
    | "dias"
    | "importe_salario"
    | "consultas_atendidas"
    | "importe_comision"
    | "tratamientos_onicomicosis"
    | "importe_por_tratamiento"
    | "importe_comision_tratamientos"
  >,
  fechaIngreso: string,
  fechaInicio: string,
  commissionTiers: ICommissionTier[],
): IPayrollPerceptionLine[] {
  const joinedDuringPeriod = fechaIngreso > fechaInicio;

  const lines: IPayrollPerceptionLine[] = [
    {
      key: "sueldo_base",
      label: "Sueldo base",
      description: `${formatDays(snapshot.dias)} × ${formatPayrollCurrency(snapshot.salario_diario)} diarios`,
      note: joinedDuringPeriod ? `Ingresó el ${formatDayMonthYear(fechaIngreso)}, proporcional` : null,
      amount: snapshot.importe_salario,
    },
  ];

  if (snapshot.importe_comision > 0) {
    lines.push({
      key: "comision_consultas",
      label: "Comisión por consultas atendidas",
      description: describeCommission(snapshot, commissionTiers),
      note: null,
      amount: snapshot.importe_comision,
    });
  }

  if (snapshot.importe_comision_tratamientos > 0) {
    lines.push({
      key: "comision_tratamientos",
      label: "Comisión por tratamientos de onicomicosis",
      description: describeTreatmentCommission(snapshot.tratamientos_onicomicosis, snapshot.importe_por_tratamiento),
      note: null,
      amount: snapshot.importe_comision_tratamientos,
    });
  }

  return lines;
}
