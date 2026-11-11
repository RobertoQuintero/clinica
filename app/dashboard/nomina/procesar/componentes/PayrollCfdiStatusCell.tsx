import type { PayrollCfdiRowState, PayrollIssuerSummary } from "@/interfaces/payroll_cfdi";
import { PAYROLL_STAMPING_BLOCK_REASON_LABELS } from "@/lib/payroll/cfdi/payrollStampingBlockers";
import PayrollCfdiCancelButton from "./PayrollCfdiCancelButton";
import PayrollCfdiRefreshStatusButton from "./PayrollCfdiRefreshStatusButton";
import PayrollCfdiStampButton from "./PayrollCfdiStampButton";

interface Props {
  state: PayrollCfdiRowState | undefined;
  idPeriod: number;
  idEmpleado: number;
  employeeName: string;
  payrollIssuer: PayrollIssuerSummary;
}

const BADGE_BASE = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap border";

const STATUS_BADGE_STYLES: Record<PayrollCfdiRowState["status"], string> = {
  pendiente: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  bloqueado: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  en_proceso: "bg-[#0051d5]/10 text-[#0051d5] border-[#0051d5]/20 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  timbrado: "bg-[#009c6b]/10 text-[#009c6b] border-[#009c6b]/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  prueba: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
  error: "bg-[#ba1a1a]/10 text-[#ba1a1a] border-[#ba1a1a]/20 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  cancelacion_en_proceso: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
};

const STATUS_LABELS: Record<PayrollCfdiRowState["status"], string> = {
  pendiente: "Pendiente",
  bloqueado: "Bloqueado",
  en_proceso: "En proceso",
  timbrado: "Timbrado",
  prueba: "Prueba",
  error: "Error",
  cancelacion_en_proceso: "Cancelación en proceso",
};

/** Columna "CFDI" de Procesar (vista fiscal): el badge del estado + un botón mínimo de cliente para timbrar, cancelar o reintentar. */
export default function PayrollCfdiStatusCell({ state, idPeriod, idEmpleado, employeeName, payrollIssuer }: Props) {
  if (!state) {
    return (
      <td className="px-4 py-3.5 text-right">
        <span className={`${BADGE_BASE} ${STATUS_BADGE_STYLES.pendiente}`}>—</span>
      </td>
    );
  }

  const tooltip =
    state.status === "bloqueado"
      ? state.reasons?.map((reason) => PAYROLL_STAMPING_BLOCK_REASON_LABELS[reason]).join("; ")
      : state.status === "error"
        ? state.receipt?.mensaje_error ?? undefined
        : undefined;

  const label =
    state.status === "cancelacion_en_proceso" && state.receipt && !state.receipt.livemode
      ? `${STATUS_LABELS[state.status]} (prueba)`
      : STATUS_LABELS[state.status];

  return (
    <td className="px-4 py-3.5 text-right">
      <div className="flex flex-col items-end gap-1.5">
        <span className={`${BADGE_BASE} ${STATUS_BADGE_STYLES[state.status]}`} title={tooltip}>
          {label}
        </span>
        {state.status === "pendiente" && (
          <PayrollCfdiStampButton idPeriod={idPeriod} idEmpleado={idEmpleado} variant="stamp" />
        )}
        {state.status === "error" && (
          <PayrollCfdiStampButton idPeriod={idPeriod} idEmpleado={idEmpleado} variant="retry" />
        )}
        {(state.status === "timbrado" || state.status === "prueba") && state.receipt && (
          <PayrollCfdiCancelButton
            receipt={state.receipt}
            employeeName={employeeName}
            issuerName={payrollIssuer.name}
          />
        )}
        {state.status === "cancelacion_en_proceso" && state.receipt && (
          <PayrollCfdiRefreshStatusButton idReceipt={state.receipt.id_period_employee_cfdi} />
        )}
      </div>
    </td>
  );
}
