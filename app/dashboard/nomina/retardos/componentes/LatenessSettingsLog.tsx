import { ArrowRight, ChevronDown } from "lucide-react";
import type {
  ILatenessFrequencyOption,
  ILatenessSettingsLogEntry,
  ILatenessTier,
} from "@/interfaces/payroll_lateness";
import { formatDateTimeSlashed } from "@/lib/payroll/moneyFormat";
import { describeLatenessTiers } from "./LatenessSettingsCard";

interface Props {
  entries: ILatenessSettingsLogEntry[];
  frequencyOptions: ILatenessFrequencyOption[];
}

/** "10 min → 15 min": resalta el valor nuevo solo si cambió; si no, todo en tono secundario. */
function ChangeCell({ previous, next, unit }: { previous: number | null; next: number; unit: string }) {
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
        {previous === null ? "—" : `${previous} ${unit}`}
      </span>
      <ArrowRight size={14} aria-hidden className="text-[#747780] dark:text-zinc-500" />
      <span
        className={
          hasChanged ? "font-semibold text-[#0051d5] dark:text-blue-300" : "text-[#44474f] dark:text-zinc-400"
        }
      >
        {next} {unit}
      </span>
    </span>
  );
}

/** Escalones por frecuencia, una línea por frecuencia con sus escalones (o "—"). */
function TiersCell({
  tiers,
  frequencyOptions,
}: {
  tiers: ILatenessTier[] | null;
  frequencyOptions: ILatenessFrequencyOption[];
}) {
  if (tiers === null) return <span className="text-[#747780] dark:text-zinc-500">—</span>;
  const lines = frequencyOptions
    .map((frequency) => ({
      frequency,
      frequencyTiers: tiers.filter((tier) => tier.id_payment_period === frequency.id_payment_period),
    }))
    .filter(({ frequencyTiers }) => frequencyTiers.length > 0);
  if (lines.length === 0) return <span className="text-[#747780] dark:text-zinc-500">Sin escalones</span>;

  return (
    <ul className="flex flex-col gap-0.5 text-xs text-[#44474f] dark:text-zinc-300">
      {lines.map(({ frequency, frequencyTiers }) => (
        <li key={frequency.id_payment_period}>
          <span className="font-semibold">{frequency.description}:</span> {describeLatenessTiers(frequencyTiers)}
        </li>
      ))}
    </ul>
  );
}

/** Plegable para que la lista de retardos siga siendo lo primero que se ve; sin JavaScript de cliente. */
export default function LatenessSettingsLog({ entries, frequencyOptions }: Props) {
  return (
    <details className="group bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-3.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-50 hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors [&::-webkit-details-marker]:hidden">
        <span>
          Historial de cambios
          <span className="ml-2 font-normal text-[#44474f] dark:text-zinc-400">
            {entries.length === 0 ? "sin cambios" : `últimos ${entries.length}`}
          </span>
        </span>
        <ChevronDown size={18} aria-hidden className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="overflow-x-auto border-t border-[#c4c6d0] dark:border-zinc-700">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700 text-sm text-[#44474f] dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold">Fecha</th>
              <th scope="col" className="px-6 py-3 font-semibold">Usuario</th>
              <th scope="col" className="px-6 py-3 font-semibold">Tolerancia</th>
              <th scope="col" className="px-6 py-3 font-semibold">Retardo grave desde</th>
              <th scope="col" className="px-6 py-3 font-semibold">Descuento grave</th>
              <th scope="col" className="px-6 py-3 font-semibold">Escalones anteriores</th>
              <th scope="col" className="px-6 py-3 font-semibold">Escalones nuevos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-[#747780] dark:text-zinc-500">
                  Sin cambios registrados
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id_log} className="hover:bg-[#f8f9ff] dark:hover:bg-zinc-800/50 transition-colors align-top">
                  <td className="px-6 py-3.5 whitespace-nowrap tabular-nums text-[#0b1c30] dark:text-zinc-100">
                    {formatDateTimeSlashed(entry.updated_at)}
                  </td>
                  <td className="px-6 py-3.5 text-[#0b1c30] dark:text-zinc-100">{entry.updated_by_name || "—"}</td>
                  <td className="px-6 py-3.5">
                    <ChangeCell
                      previous={entry.tolerancia_minutos_anterior}
                      next={entry.tolerancia_minutos_nuevo}
                      unit="min"
                    />
                  </td>
                  <td className="px-6 py-3.5">
                    <ChangeCell
                      previous={entry.minutos_retardo_grave_anterior}
                      next={entry.minutos_retardo_grave_nuevo}
                      unit="min"
                    />
                  </td>
                  <td className="px-6 py-3.5">
                    <ChangeCell
                      previous={entry.dias_descuento_retardo_grave_anterior}
                      next={entry.dias_descuento_retardo_grave_nuevo}
                      unit="d"
                    />
                  </td>
                  <td className="px-6 py-3.5">
                    <TiersCell tiers={entry.escalones_anteriores} frequencyOptions={frequencyOptions} />
                  </td>
                  <td className="px-6 py-3.5">
                    <TiersCell tiers={entry.escalones_nuevos} frequencyOptions={frequencyOptions} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}
