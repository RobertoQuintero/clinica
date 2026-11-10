/**
 * Reglas puras de "timbrable" de una fila fiscal de nómina (spec 98). Sin SQL, sin Facturapi:
 * reutiliza `getStampingIssues` (spec 71) y recibe ya resueltos los demás hechos (ISR, IMSS,
 * exención por línea, emisor activo). `[]` = timbrable.
 */
import type { PayrollPeriodStatus, PayrollPeriodType } from "@/interfaces/payroll_period";
import type { PayrollStampingBlockReason } from "@/interfaces/payroll_cfdi";
import { getStampingIssues, StampingEmployeeInput } from "@/lib/payroll/payrollStampingReadiness";

/** Estatus en el que un periodo se puede timbrar: 4, Pagada. */
export const PAYROLL_STAMPABLE_PERIOD_STATUS: PayrollPeriodStatus = 4;

export interface PayrollStampingBlockersInput {
  periodType: PayrollPeriodType;
  periodStatus: PayrollPeriodStatus;
  employee: StampingEmployeeInput;
  branchStateKey: string | null;
  isrEstado: string | null;             // 'C' | 'N' | 'X'
  imssEstado: string | null;            // 'C' | 'N' | 'X'
  hasUncalculatedExemption: boolean;    // alguna period_employee_perceptions.exencion_estado = 'N'
  payrollIssuer: { active: boolean; hasCertificate: boolean } | null;
}

/** Motivos por los que la fila no se puede timbrar todavía. `[]` = timbrable. */
export function getPayrollStampingBlockReasons(
  input: PayrollStampingBlockersInput
): PayrollStampingBlockReason[] {
  const reasons: PayrollStampingBlockReason[] = [];

  if (input.periodType !== "O") reasons.push("period_not_ordinary");
  if (input.periodStatus !== PAYROLL_STAMPABLE_PERIOD_STATUS) reasons.push("period_not_paid");

  if (getStampingIssues(input.employee, input.branchStateKey).length > 0) {
    reasons.push("employee_fiscal_data");
  }
  if (input.isrEstado !== "C") reasons.push("isr_not_calculated");
  if (input.imssEstado !== "C" && input.imssEstado !== "X") reasons.push("imss_not_calculated");
  if (input.hasUncalculatedExemption) reasons.push("exemption_not_calculated");

  if (!input.payrollIssuer || !input.payrollIssuer.active) {
    reasons.push("no_payroll_issuer");
  } else if (!input.payrollIssuer.hasCertificate) {
    reasons.push("issuer_without_certificate");
  }

  return reasons;
}

/** Texto en español por motivo, para el tooltip de "Bloqueado" y el mensaje de la action. */
export const PAYROLL_STAMPING_BLOCK_REASON_LABELS: Record<PayrollStampingBlockReason, string> = {
  employee_fiscal_data: "Faltan o son inválidos los datos fiscales del empleado",
  isr_not_calculated: "El ISR del periodo no está calculado",
  imss_not_calculated: "El IMSS del periodo no está calculado",
  exemption_not_calculated: "Alguna percepción quedó sin gravado/exento calculado",
  no_payroll_issuer: "No hay un emisor de nómina activo en la empresa",
  issuer_without_certificate: "El emisor de nómina no tiene un certificado (CSD) vigente",
  period_not_paid: "El periodo no está en estatus Pagada",
  period_not_ordinary: "El periodo no es ordinario",
};
