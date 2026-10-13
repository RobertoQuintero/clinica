import db from "@/database/connection";
import { requireBillingAccess } from "@/lib/auth/session";
import { getPayrollIssuerUid } from "@/lib/billing/organizationsRepository";
import { listOrganizations } from "./actions";
import OrganizationsTable from "./componentes/OrganizationsTable";

/** `uid` de la organización que timbra nómina, para el badge del listado (spec 72). No bloquea la página si falla. */
async function findPayrollIssuerUid(): Promise<string | null> {
  try {
    const { id_empresa } = await requireBillingAccess();
    return await getPayrollIssuerUid(db, id_empresa);
  } catch {
    return null;
  }
}

/** Server Component: trae el listado (ya filtrado por empresa en la action) de una vez. */
export default async function FacturacionPage() {
  const [result, payrollIssuerUid] = await Promise.all([listOrganizations(), findPayrollIssuerUid()]);
  const organizations = result.ok ? result.data : [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50 mb-1">Facturación</h2>
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          Organizaciones fiscales de la empresa y su configuración de facturación electrónica.
        </p>
      </div>

      {!result.ok && (
        <p className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {result.message}
        </p>
      )}

      <OrganizationsTable organizations={organizations} payrollIssuerUid={payrollIssuerUid} />
    </div>
  );
}
