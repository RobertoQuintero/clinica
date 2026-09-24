import { ArrowRight } from "lucide-react";
import type { ITreatmentCommissionSettingsLogEntry } from "@/interfaces/payroll_treatment_commission";
import { formatDateTimeSlashed, formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

interface Props {
  entries: ITreatmentCommissionSettingsLogEntry[];
}

/** "$500.00 → $600.00": resalta el valor nuevo solo si cambió; si no, todo en tono secundario. */
function ChangeCell({ previous, next }: { previous: number | null; next: number }) {
  const hasChanged = previous !== next;
  return (
    <span className="inline-flex items-center gap-2 tabular-nums whitespace-nowrap">
      <span
        className={
          hasChanged
            ? "text-[#747780] dark:text-zinc-500 line-through"
            : "text-[#44474f] dark:text-zinc-400"
        }
      >
        {previous === null ? "—" : formatPayrollCurrency(previous)}
      </span>
      <ArrowRight size={14} aria-hidden className="text-[#747780] dark:text-zinc-500" />
      <span
        className={
          hasChanged ? "font-semibold text-[#0051d5] dark:text-blue-300" : "text-[#44474f] dark:text-zinc-400"
        }
      >
        {formatPayrollCurrency(next)}
      </span>
    </span>
  );
}

export default function TreatmentCommissionSettingsLog({ entries }: Props) {
  return (
    <section aria-labelledby="treatment-commission-log-title" className="flex flex-col gap-3">
      <h3 id="treatment-commission-log-title" className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">
        Historial de cambios
      </h3>
      <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Fecha</th>
                <th className="px-6 py-4 font-semibold">Usuario</th>
                <th className="px-6 py-4 font-semibold">Importe por tratamiento</th>
                <th className="px-6 py-4 font-semibold">Umbral de liquidación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[#747780] dark:text-zinc-500">
                    Sin cambios registrados
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id_log} className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap tabular-nums text-[#0b1c30] dark:text-zinc-100">
                      {formatDateTimeSlashed(entry.updated_at)}
                    </td>
                    <td className="px-6 py-4 text-[#0b1c30] dark:text-zinc-100">{entry.updated_by_nombre || "—"}</td>
                    <td className="px-6 py-4">
                      <ChangeCell
                        previous={entry.importe_por_tratamiento_anterior}
                        next={entry.importe_por_tratamiento_nuevo}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <ChangeCell
                        previous={entry.umbral_liquidacion_anterior}
                        next={entry.umbral_liquidacion_nuevo}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
