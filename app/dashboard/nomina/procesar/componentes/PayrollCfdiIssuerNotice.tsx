import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { PayrollIssuerSummary } from "@/interfaces/payroll_cfdi";

interface Props {
  payrollIssuer: PayrollIssuerSummary;
}

/** Aviso de Procesar (vista fiscal, periodo ordinario) cuando no hay emisor de nómina listo para timbrar. */
export default function PayrollCfdiIssuerNotice({ payrollIssuer }: Props) {
  if (payrollIssuer.active && payrollIssuer.hasCertificate) return null;

  return (
    <section
      aria-label="Emisor de nómina no listo para timbrar"
      className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex gap-3"
    >
      <TriangleAlert size={20} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {payrollIssuer.active ? "El emisor de nómina no tiene un certificado (CSD) vigente" : "No hay un emisor de nómina activo"}
        </p>
        <p className="text-sm text-amber-800 dark:text-amber-300/90 mt-0.5">
          {payrollIssuer.active
            ? "Ninguna fila se puede timbrar hasta que cargues el CSD de la organización."
            : "Activa una organización como emisor de nómina en Facturación antes de timbrar."}
        </p>
        <Link
          href="/dashboard/facturacion"
          className="mt-2 inline-block text-sm font-medium text-[#0051d5] dark:text-blue-300 underline-offset-2 hover:underline"
        >
          Ir a Facturación
        </Link>
      </div>
    </section>
  );
}
