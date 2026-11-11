/**
 * Reglas puras de cancelación de CFDI de nómina (spec 99): sin SQL, importable desde el cliente.
 */
import { z } from "zod";
import { CancellationStatus, InvoiceStatus, type Invoice } from "facturapi";
import { CANCELLATION_MOTIVE_OPTIONS } from "@/lib/billing/invoiceCatalogs";
import type { IPayrollCfdiReceipt } from "@/interfaces/payroll_cfdi";

/** Catálogo de `CANCELLATION_MOTIVE_OPTIONS` filtrado a los dos motivos que esta spec permite. */
export const PAYROLL_CFDI_CANCELLATION_MOTIVE_OPTIONS = CANCELLATION_MOTIVE_OPTIONS.filter(
  (option) => option.code === "02" || option.code === "03",
);

export const cancelPayrollReceiptSchema = z.object({
  idReceipt: z.number().int().positive("Recibo inválido"),
  motive: z.enum(["02", "03"], { message: "Motivo de cancelación inválido" }),
  confirmFolio: z.string().optional(),
});

export type CancelPayrollReceiptInput = z.infer<typeof cancelPayrollReceiptSchema>;

export type PayrollCancellationOutcome = "cancelled" | "pending" | "not_cancelled";

/**
 * Traduce la respuesta de Facturapi (`invoices.cancel`/`invoices.retrieve`) al desenlace que le
 * importa a esta spec. `status === 'canceled'` manda; si no, `cancellation_status` distingue entre
 * "sigue en trámite ante el SAT" (`pending`/`verifying`) y "no se canceló" (el resto).
 */
export function resolveCancellationOutcome(invoice: Invoice): PayrollCancellationOutcome {
  if (invoice.status === InvoiceStatus.CANCELED) return "cancelled";

  if (
    invoice.cancellation_status === CancellationStatus.PENDING ||
    invoice.cancellation_status === CancellationStatus.VERIFYING
  ) {
    return "pending";
  }

  return "not_cancelled";
}

/** `NOM-{folio}`, la confirmación que Live exige escribir antes de cancelar. */
export function formatPayrollReceiptFolio(receipt: Pick<IPayrollCfdiReceipt, "folio">): string {
  return `NOM-${receipt.folio ?? ""}`;
}
