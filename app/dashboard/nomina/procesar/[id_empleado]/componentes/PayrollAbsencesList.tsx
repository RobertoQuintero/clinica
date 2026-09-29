import { UserX } from "lucide-react";
import type { IPayrollDiscountedAbsence } from "@/interfaces/payroll_absence";
import { formatPeriodDate } from "@/lib/payroll/periodFormat";

interface Props {
  discountedAbsences: IPayrollDiscountedAbsence[];
}

/** Faltas injustificadas descontadas del tipo de nómina seleccionado; se oculta si no hay ninguna (spec 62). */
export default function PayrollAbsencesList({ discountedAbsences }: Props) {
  if (discountedAbsences.length === 0) return null;

  return (
    <section
      aria-labelledby="payroll-absences-title"
      className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden"
    >
      <header className="px-5 py-4 bg-[#f8f9ff] dark:bg-zinc-800/60 border-b border-[#e5e8f0] dark:border-zinc-700 flex items-center gap-3">
        <span className="w-9 h-9 rounded-lg bg-[#dce9ff] dark:bg-zinc-800 text-[#0051d5] dark:text-blue-300 flex items-center justify-center">
          <UserX size={18} aria-hidden />
        </span>
        <div className="flex flex-col">
          <h3 id="payroll-absences-title" className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">
            Faltas descontadas en este periodo
          </h3>
          <span className="text-xs text-[#44474f] dark:text-zinc-400">
            {discountedAbsences.length} {discountedAbsences.length === 1 ? "día descontado" : "días descontados"} del
            sueldo base
          </span>
        </div>
      </header>

      <ul className="flex flex-wrap gap-2 px-5 py-4">
        {discountedAbsences.map((absence) => (
          <li
            key={absence.fecha}
            className="rounded-full border border-[#c4c6d0] dark:border-zinc-600 bg-[#eff4ff] dark:bg-zinc-800 px-3 py-1 text-sm font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100"
          >
            {formatPeriodDate(absence.fecha)}
          </li>
        ))}
      </ul>
    </section>
  );
}
