import type { ReactNode } from "react";
import type { IVacationEntitlementView } from "@/interfaces/vacation";
import { daysBetween } from "@/lib/vacations/vacationDates";
import {
  formatDateTimeForDisplay,
  formatIsoDateForDisplay,
  getVacationStatusLabel,
} from "@/lib/vacations/vacationFormatting";
import VacationStatusBadge from "@/app/dashboard/empleados/componentes/VacationStatusBadge";
import VacationPayrollStatus from "./VacationPayrollStatus";

interface Props {
  entitlement: IVacationEntitlementView;
  today: string;
  /** Botones de acción (captura, reprogramación, pago…); llegan en pasos posteriores. */
  actions?: ReactNode;
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#74777f] dark:text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-[#0b1c30] dark:text-zinc-100">{children}</dd>
    </div>
  );
}

export default function VacationCurrentYearCard({ entitlement, today, actions }: Props) {
  const hasBlock = entitlement.fecha_inicio !== null && entitlement.fecha_fin !== null;
  const daysToDeadline = daysBetween(today, entitlement.fecha_limite_solicitud);
  const isUrgent =
    entitlement.status === "pendiente" && daysToDeadline >= 0 && daysToDeadline <= 30;

  return (
    <section
      aria-label="Año de derecho vigente"
      className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm"
    >
      <header className="p-5 border-b border-[#c4c6d0] dark:border-zinc-700 flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-bold text-[#0b1c30] dark:text-zinc-50">
          Año de servicio {entitlement.anio_servicio}
        </h3>
        <VacationStatusBadge
          status={entitlement.status}
          label={getVacationStatusLabel(entitlement)}
          isUrgent={isUrgent}
        />
        <span className="text-xs text-[#74777f] dark:text-zinc-500 sm:ml-auto">
          Del {formatIsoDateForDisplay(entitlement.fecha_aniversario)} al{" "}
          {formatIsoDateForDisplay(entitlement.fecha_siguiente_aniversario)}
        </span>
      </header>

      <dl className="p-5 grid gap-5 grid-cols-2 lg:grid-cols-4">
        <DetailItem label="Días de derecho">
          <span className="text-2xl font-bold tabular-nums">{entitlement.dias_derecho}</span>
        </DetailItem>

        <DetailItem label="Solicitar a más tardar">
          <span className="font-semibold">
            {formatIsoDateForDisplay(entitlement.fecha_limite_solicitud)}
          </span>
          {entitlement.status === "pendiente" && (
            <span
              className={`block text-xs mt-0.5 ${
                isUrgent ? "text-amber-700 dark:text-amber-300" : "text-[#74777f] dark:text-zinc-500"
              }`}
            >
              {daysToDeadline === 0
                ? "Vence hoy"
                : `Faltan ${daysToDeadline} ${daysToDeadline === 1 ? "día" : "días"}`}
            </span>
          )}
        </DetailItem>

        <DetailItem label="Bloque de vacaciones">
          {hasBlock ? (
            <>
              <span className="font-semibold">
                {formatIsoDateForDisplay(entitlement.fecha_inicio)} al{" "}
                {formatIsoDateForDisplay(entitlement.fecha_fin)}
              </span>
              <span className="block text-xs text-[#74777f] dark:text-zinc-500 mt-0.5">
                {entitlement.dias_tomados} {entitlement.dias_tomados === 1 ? "día" : "días"} ·
                solicitado el{" "}
                {entitlement.solicitado_at
                  ? formatDateTimeForDisplay(entitlement.solicitado_at)
                  : "—"}
              </span>
            </>
          ) : (
            <span className="text-[#74777f] dark:text-zinc-500">Sin bloque capturado</span>
          )}
        </DetailItem>

        <DetailItem label="Pago de días sobrantes">
          {entitlement.fecha_pago ? (
            <>
              <span className="font-semibold">
                {entitlement.dias_pagados} {entitlement.dias_pagados === 1 ? "día" : "días"}
              </span>
              <span className="block text-xs text-[#74777f] dark:text-zinc-500 mt-0.5">
                pagados el {formatIsoDateForDisplay(entitlement.fecha_pago)}
                {entitlement.comentario_pago ? ` · ${entitlement.comentario_pago}` : ""}
              </span>
            </>
          ) : entitlement.dias_por_pagar > 0 ? (
            <span className="font-semibold text-[#ba1a1a] dark:text-red-400">
              {entitlement.dias_por_pagar} {entitlement.dias_por_pagar === 1 ? "día" : "días"} por pagar
            </span>
          ) : (
            <span className="text-[#74777f] dark:text-zinc-500">Nada por pagar</span>
          )}
        </DetailItem>

        <DetailItem label="Nómina">
          <VacationPayrollStatus entitlement={entitlement} />
        </DetailItem>
      </dl>

      {actions && (
        <footer className="px-5 py-4 border-t border-[#c4c6d0] dark:border-zinc-700 flex flex-wrap gap-2">
          {actions}
        </footer>
      )}
    </section>
  );
}
