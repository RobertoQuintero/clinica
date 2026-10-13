import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import type { Organization } from "facturapi";
import { taxSystemLabel } from "@/lib/billing/taxSystemCatalog";

interface Props {
  organization: Organization;
  /** Es la organización que timbra la nómina de la empresa (spec 72). */
  isPayrollIssuer: boolean;
}

export default function OrganizationRow({ organization, isPayrollIssuer }: Props) {
  const { legal } = organization;

  return (
    <tr className="hover:bg-[#f8f9fb] dark:hover:bg-zinc-800/50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/facturacion/${organization.id}/general`}
            className="font-semibold text-[#0b1c30] dark:text-zinc-100 hover:text-[#0051d5] dark:hover:text-blue-400"
          >
            {legal.name || legal.legal_name}
          </Link>
          {isPayrollIssuer && (
            <span className="flex items-center gap-1 rounded-full bg-[#009c6b]/10 px-2.5 py-0.5 text-xs font-semibold text-[#009c6b] dark:bg-emerald-900/20 dark:text-emerald-400">
              <BadgeCheck size={12} />
              Timbra nómina
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">{legal.legal_name}</td>
      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400 font-mono text-xs">{legal.tax_id}</td>
      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">{taxSystemLabel(legal.tax_system)}</td>
      <td className="px-6 py-4 text-[#44474f] dark:text-zinc-400">
        {[legal.address.city, legal.address.state].filter(Boolean).join(", ") || "—"}
      </td>
      <td className="px-6 py-4 text-right">
        <Link
          href={`/dashboard/facturacion/${organization.id}/general`}
          className="whitespace-nowrap text-sm font-semibold text-[#0051d5] dark:text-blue-400 hover:underline"
        >
          Ver detalle
        </Link>
      </td>
    </tr>
  );
}
