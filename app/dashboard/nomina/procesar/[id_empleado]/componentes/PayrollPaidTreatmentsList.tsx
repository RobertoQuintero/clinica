import Link from "next/link";
import { ExternalLink, Stethoscope } from "lucide-react";
import type { IPayrollPaidTreatment } from "@/interfaces/payroll_treatment_commission";
import { formatDateTimeSlashed, formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

interface Props {
  paidTreatments: IPayrollPaidTreatment[];
}

function describeTreatmentCount(count: number): string {
  return count === 1 ? "1 tratamiento" : `${count} tratamientos`;
}

export default function PayrollPaidTreatmentsList({ paidTreatments }: Props) {
  if (paidTreatments.length === 0) return null;

  return (
    <section
      aria-labelledby="payroll-paid-treatments-title"
      className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden"
    >
      <header className="px-5 py-4 bg-[#f8f9ff] dark:bg-zinc-800/60 border-b border-[#e5e8f0] dark:border-zinc-700 flex items-center gap-3">
        <span className="w-9 h-9 rounded-lg bg-[#dce9ff] dark:bg-zinc-800 text-[#0051d5] dark:text-blue-300 flex items-center justify-center">
          <Stethoscope size={18} aria-hidden />
        </span>
        <div className="flex flex-col">
          <h3
            id="payroll-paid-treatments-title"
            className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50"
          >
            Tratamientos pagados en este periodo
          </h3>
          <span className="text-xs text-[#44474f] dark:text-zinc-400">
            {describeTreatmentCount(paidTreatments.length)} · fecha en que se liquidó cada uno
          </span>
        </div>
      </header>

      <ul className="divide-y divide-[#e5e8f0] dark:divide-zinc-800">
        {paidTreatments.map((paidTreatment) => (
          <li
            key={paidTreatment.id_tratamiento}
            className="px-5 py-3.5 flex items-center justify-between gap-4"
          >
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 truncate">
                {paidTreatment.nombre_paciente || `Tratamiento #${paidTreatment.id_tratamiento}`}
              </span>
              <span className="text-xs text-[#44474f] dark:text-zinc-400 tabular-nums">
                Liquidado el {formatDateTimeSlashed(paidTreatment.fecha_liquidacion)} · parciales{" "}
                {formatPayrollCurrency(paidTreatment.total_parciales)}
              </span>
            </div>
            <Link
              href={`/dashboard/tratamientos/${paidTreatment.id_tratamiento}`}
              aria-label={`Abrir el tratamiento de ${paidTreatment.nombre_paciente || `#${paidTreatment.id_tratamiento}`}`}
              title="Abrir tratamiento"
              className="inline-flex w-8 h-8 shrink-0 items-center justify-center rounded-lg text-[#44474f] dark:text-zinc-400 hover:bg-[#dce9ff] hover:text-[#0051d5] dark:hover:bg-zinc-800 dark:hover:text-blue-300 transition-colors"
            >
              <ExternalLink size={16} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
