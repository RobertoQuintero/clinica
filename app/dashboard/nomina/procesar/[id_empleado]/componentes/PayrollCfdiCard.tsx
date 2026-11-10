import Link from "next/link";
import { CircleAlert, Download, FileCheck2, Hourglass, Stamp, TriangleAlert } from "lucide-react";
import type { PayrollCfdiRowState, PayrollIssuerSummary, PayrollStampingBlockReason } from "@/interfaces/payroll_cfdi";
import { PAYROLL_STAMPING_BLOCK_REASON_LABELS } from "@/lib/payroll/cfdi/payrollStampingBlockers";
import { formatPeriodDate } from "@/lib/payroll/periodFormat";
import { buildTaxParametersHref, type TaxParametersTab } from "@/lib/payroll/taxParametersUrls";
import PayrollCfdiStampButton from "../../componentes/PayrollCfdiStampButton";

interface Props {
  cfdi: PayrollCfdiRowState | null;
  payrollIssuer: PayrollIssuerSummary | null;
  idPeriod: number;
  idEmpleado: number;
  fiscalYear: number;
}

type ReasonLink = { href: string; label: string } | null;

function formatReceiptDateTime(value: string): string {
  return `${formatPeriodDate(value.slice(0, 10))}, ${value.slice(11, 16)}`;
}

function buildReasonLink(reason: PayrollStampingBlockReason, idEmpleado: number, fiscalYear: number): ReasonLink {
  const taxParametersTab = (tab: TaxParametersTab): ReasonLink => ({
    href: buildTaxParametersHref(tab, fiscalYear),
    label: "Revisar los parámetros fiscales",
  });

  switch (reason) {
    case "employee_fiscal_data":
      return { href: `/dashboard/empleados/${idEmpleado}`, label: "Revisar el expediente" };
    case "isr_not_calculated":
      return taxParametersTab("withholding");
    case "imss_not_calculated":
    case "exemption_not_calculated":
      return taxParametersTab("parameters");
    case "no_payroll_issuer":
    case "issuer_without_certificate":
      return { href: "/dashboard/facturacion", label: "Ir a Facturación" };
    case "period_not_paid":
    case "period_not_ordinary":
      return null;
  }
}

/** Tarjeta "CFDI" del Detalle, debajo de Deducciones: solo en la vista fiscal de un periodo ordinario (spec 98). */
export default function PayrollCfdiCard({ cfdi, payrollIssuer, idPeriod, idEmpleado, fiscalYear }: Props) {
  if (!cfdi) return null;

  return (
    <section
      aria-labelledby="payroll-cfdi-title"
      className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden"
    >
      <header className="px-5 py-4 bg-[#f8f9ff] dark:bg-zinc-800/60 border-b border-[#e5e8f0] dark:border-zinc-700 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-[#0051d5]/10 dark:bg-blue-900/30 text-[#0051d5] dark:text-blue-300 flex items-center justify-center">
            <Stamp size={18} aria-hidden />
          </span>
          <h3 id="payroll-cfdi-title" className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">
            CFDI
          </h3>
        </div>
        <CfdiStatusBadge status={cfdi.status} />
      </header>

      <div className="px-5 py-4">
        {cfdi.status === "pendiente" && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-[#44474f] dark:text-zinc-400">Este recibo todavía no se ha timbrado.</p>
            <PayrollCfdiStampButton idPeriod={idPeriod} idEmpleado={idEmpleado} variant="stamp" />
          </div>
        )}

        {cfdi.status === "en_proceso" && (
          <p className="flex gap-2 text-sm text-[#44474f] dark:text-zinc-400">
            <Hourglass size={16} className="shrink-0 mt-0.5" aria-hidden />
            Timbrando con el PAC. Esto solo toma unos segundos; refresca la página si no cambia.
          </p>
        )}

        {cfdi.status === "bloqueado" && (
          <div>
            <p className="flex gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
              <TriangleAlert size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
              No se puede timbrar todavía
            </p>
            <ul className="mt-2 flex flex-col gap-1.5 pl-7">
              {(cfdi.reasons ?? []).map((reason) => {
                const link = buildReasonLink(reason, idEmpleado, fiscalYear);
                return (
                  <li key={reason} className="flex flex-wrap items-baseline gap-x-2 text-sm text-amber-900 dark:text-amber-200">
                    <span>{PAYROLL_STAMPING_BLOCK_REASON_LABELS[reason]}.</span>
                    {link && (
                      <Link
                        href={link.href}
                        className="font-medium text-[#0051d5] dark:text-blue-300 underline-offset-2 hover:underline"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {cfdi.status === "error" && cfdi.receipt && (
          <div>
            <div className="flex items-start justify-between gap-4">
              <p className="flex gap-2 text-sm text-[#ba1a1a] dark:text-red-400">
                <CircleAlert size={16} className="shrink-0 mt-0.5" aria-hidden />
                <span>
                  <span className="font-semibold">El PAC rechazó el timbrado.</span> {cfdi.receipt.mensaje_error}
                </span>
              </p>
              <PayrollCfdiStampButton idPeriod={idPeriod} idEmpleado={idEmpleado} variant="retry" />
            </div>
          </div>
        )}

        {(cfdi.status === "timbrado" || cfdi.status === "prueba") && cfdi.receipt && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 shrink-0 rounded-lg bg-[#009c6b]/10 dark:bg-emerald-900/30 text-[#009c6b] dark:text-emerald-400 flex items-center justify-center">
                <FileCheck2 size={18} aria-hidden />
              </span>
              <dl className="flex-1 min-w-0 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-[#44474f] dark:text-zinc-400">UUID</dt>
                <dd className="font-mono text-xs text-[#0b1c30] dark:text-zinc-100 break-all">{cfdi.receipt.uuid}</dd>
                <dt className="text-[#44474f] dark:text-zinc-400">Serie / folio</dt>
                <dd className="tabular-nums text-[#0b1c30] dark:text-zinc-100">
                  {cfdi.receipt.serie}-{cfdi.receipt.folio}
                </dd>
                <dt className="text-[#44474f] dark:text-zinc-400">Fecha de timbrado</dt>
                <dd className="tabular-nums text-[#0b1c30] dark:text-zinc-100">
                  {cfdi.receipt.fecha_timbrado ? formatReceiptDateTime(cfdi.receipt.fecha_timbrado) : "—"}
                </dd>
                <dt className="text-[#44474f] dark:text-zinc-400">Emisor</dt>
                <dd className="text-[#0b1c30] dark:text-zinc-100">
                  {payrollIssuer?.name ?? "—"} ({cfdi.receipt.livemode ? "Live" : "Test"})
                </dd>
              </dl>
            </div>
            <div className="flex flex-wrap gap-2 pl-12">
              <Link
                href={`/api/nomina/cfdi/${cfdi.receipt.id_period_employee_cfdi}/xml`}
                className="inline-flex items-center gap-2 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
              >
                <Download size={14} aria-hidden />
                XML
              </Link>
              <Link
                href={`/api/nomina/cfdi/${cfdi.receipt.id_period_employee_cfdi}/pdf`}
                className="inline-flex items-center gap-2 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
              >
                <Download size={14} aria-hidden />
                PDF
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const STATUS_BADGE_STYLES: Record<PayrollCfdiRowState["status"], string> = {
  pendiente: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  bloqueado: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  en_proceso: "bg-[#0051d5]/10 text-[#0051d5] border-[#0051d5]/20 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  timbrado: "bg-[#009c6b]/10 text-[#009c6b] border-[#009c6b]/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  prueba: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
  error: "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
};

const STATUS_LABELS: Record<PayrollCfdiRowState["status"], string> = {
  pendiente: "Pendiente",
  bloqueado: "Bloqueado",
  en_proceso: "En proceso",
  timbrado: "Timbrado",
  prueba: "Prueba",
  error: "Error",
};

function CfdiStatusBadge({ status }: { status: PayrollCfdiRowState["status"] }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap border ${STATUS_BADGE_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
