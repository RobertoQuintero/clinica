import { ShieldCheck } from "lucide-react";
import type { IPayrollPeriodStatusStamp } from "@/interfaces/payroll_period";
import { formatDateTimeSlashed } from "@/lib/payroll/moneyFormat";

interface Props {
  statusStamp: IPayrollPeriodStatusStamp | null;
}

/** Sello de la última aprobación y, si ya se pagó, del pago. Oculto si el periodo nunca se aprobó. */
export default function PayrollPeriodStatusStamp({ statusStamp }: Props) {
  if (!statusStamp || !statusStamp.approved_at) return null;

  return (
    <div className="flex flex-col gap-0.5 text-sm text-[#44474f] dark:text-zinc-400">
      <span className="flex items-center gap-1.5">
        <ShieldCheck size={14} className="text-[#009c6b]" aria-hidden />
        Aprobada por {statusStamp.approved_by_name} el {formatDateTimeSlashed(statusStamp.approved_at)}
      </span>
      {statusStamp.paid_at && (
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-[#009c6b]" aria-hidden />
          Pagada por {statusStamp.paid_by_name} el {formatDateTimeSlashed(statusStamp.paid_at)}
        </span>
      )}
    </div>
  );
}
