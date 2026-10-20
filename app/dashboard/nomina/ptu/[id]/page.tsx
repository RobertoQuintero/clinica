import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PTU_TAXPAYER_TYPE_LABELS } from "@/lib/payroll/constants";
import { formatDateTimeSlashed, formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { getPtuDistributionDetail } from "../actions";
import PreloadPtuEmployeesButton from "../componentes/PreloadPtuEmployeesButton";
import { EditPtuDistributionButton } from "../componentes/PtuDistributionActions";
import { PtuDistributionStatusBadge } from "../componentes/PtuDistributionBadges";
import PtuDistributionEmployeesTable from "../componentes/PtuDistributionEmployeesTable";
import { AddPtuEmployeeButton } from "../componentes/PtuEmployeeActions";
import PtuDistributionLog from "../componentes/PtuDistributionLog";
import PtuDistributionStatusActions from "../componentes/PtuDistributionStatusActions";
import PtuDistributionSummaryCards from "../componentes/PtuDistributionSummaryCards";
import { describePtuReopenBlocked } from "@/lib/payroll/ptuPaymentSource";

export default async function PtuDistributionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getPtuDistributionDetail(Number(id));

  if (!result.ok) {
    return (
      <p role="alert" className="rounded-xl border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 px-4 py-3 text-sm text-[#ba1a1a] dark:text-red-400">
        {result.message}
      </p>
    );
  }
  if (result.data === null) notFound();

  const { distribution, employees, log, payrollUsage } = result.data;
  const isDraft = distribution.estado === "B";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-[#44474f] dark:text-zinc-400">
            <span>Nómina</span>
            <ChevronRight size={14} />
            <Link href="/dashboard/nomina/ptu" className="hover:text-[#0051d5] hover:underline">
              PTU
            </Link>
            <ChevronRight size={14} />
            <span className="font-medium text-[#0b1c30] dark:text-zinc-100">Ejercicio {distribution.ejercicio}</span>
          </div>
          <div className="mt-1 mb-1 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-[#0b1c30] dark:text-zinc-50">
              Reparto de PTU {distribution.ejercicio}
            </h2>
            <PtuDistributionStatusBadge status={distribution.estado} />
          </div>
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            Cálculo para toda la empresa. Cada cambio recalcula el reparto completo.
          </p>
        </div>
        {isDraft && (
          <PreloadPtuEmployeesButton
            idPtuDistribution={distribution.id_ptu_distribution}
            fiscalYear={distribution.ejercicio}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#44474f] dark:text-zinc-400">
          {isDraft
            ? "En borrador: se puede editar. Ciérralo cuando el contador valide los montos."
            : `Cerrado el ${formatDateTimeSlashed(distribution.cerrado_at ?? distribution.updated_at)}. Es de solo lectura; reábrelo para modificarlo.`}
        </p>
        <PtuDistributionStatusActions
          idPtuDistribution={distribution.id_ptu_distribution}
          fiscalYear={distribution.ejercicio}
          status={distribution.estado}
          reopenBlockedReason={payrollUsage ? describePtuReopenBlocked(payrollUsage) : null}
        />
      </div>

      <section
        aria-label="Parámetros del reparto"
        className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-xl border border-[#c4c6d0] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-4 shadow-sm"
      >
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">Persona</dt>
            <dd className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
              {PTU_TAXPAYER_TYPE_LABELS[distribution.tipo_persona]}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
              Renta gravable
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100">
              {formatPayrollCurrency(distribution.renta_gravable)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
              PTU no cobrada anterior
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100">
              {formatPayrollCurrency(distribution.ptu_no_cobrada_anterior)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
              Factor de 3 meses
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100">
              {distribution.factor_tres_meses} días
            </dd>
          </div>
        </dl>
        {isDraft && <EditPtuDistributionButton distribution={distribution} />}
      </section>

      <PtuDistributionSummaryCards distribution={distribution} />
      <section aria-label="Trabajadores del reparto" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
            Trabajadores
            <span className="ml-2 text-sm font-normal text-[#44474f] dark:text-zinc-400">{employees.length}</span>
          </h3>
          {isDraft && (
            <AddPtuEmployeeButton
              idPtuDistribution={distribution.id_ptu_distribution}
              fiscalYear={distribution.ejercicio}
            />
          )}
        </div>
        <PtuDistributionEmployeesTable
          idPtuDistribution={distribution.id_ptu_distribution}
          employees={employees}
          fiscalYear={distribution.ejercicio}
          isEditable={isDraft}
        />
      </section>
      <PtuDistributionLog entries={log} />
    </div>
  );
}
