import type { ReactNode } from "react";
import { AlarmClock } from "lucide-react";
import type { ILatenessFrequencyOption, ILatenessSettings } from "@/interfaces/payroll_lateness";
import { formatDateTimeSlashed } from "@/lib/payroll/moneyFormat";

interface Props {
  settings: ILatenessSettings | null;
  frequencyOptions: ILatenessFrequencyOption[];
  /** Botón "Editar": la tarjeta lo aloja en su encabezado. */
  editAction?: ReactNode;
}

function SettingValue({ label, hint, value }: { label: string; hint: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
        {label}
      </span>
      <span className="text-2xl font-bold tabular-nums text-[#0b1c30] dark:text-zinc-50">{value}</span>
      <span className="text-xs text-[#44474f] dark:text-zinc-400">{hint}</span>
    </div>
  );
}

/** "1 retardo → 0.5 días · 2 retardos → 1 día". */
export function describeLatenessTiers(tiers: { retardos: number; dias_descuento: number }[]): string {
  return tiers
    .map(
      (tier) =>
        `${tier.retardos} ${tier.retardos === 1 ? "retardo" : "retardos"} → ${tier.dias_descuento} ${tier.dias_descuento === 1 ? "día" : "días"}`,
    )
    .join(" · ");
}

export default function LatenessSettingsCard({ settings, frequencyOptions, editAction }: Props) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 py-4 bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-[#dce9ff] dark:bg-zinc-700 text-[#0051d5] dark:text-blue-300 flex items-center justify-center">
            <AlarmClock size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">Reglas de retardos</h3>
            <p className="text-sm text-[#44474f] dark:text-zinc-400">
              Se aplican a toda la empresa y a los periodos que aún no se aprueban.
            </p>
          </div>
        </div>
        {editAction}
      </div>

      {settings === null ? (
        <p className="px-6 py-8 text-center text-[#747780] dark:text-zinc-500">
          Sin configuración de retardos: no se detecta ni se descuenta ningún retardo
        </p>
      ) : (
        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <SettingValue
              label="Tolerancia"
              hint="Minutos tarde a partir de los cuales hay retardo."
              value={`${settings.tolerancia_minutos} min`}
            />
            <SettingValue
              label="Retardo grave desde"
              hint="Un retardo así de largo es grave y no suma a los escalones."
              value={`${settings.minutos_retardo_grave} min`}
            />
            <SettingValue
              label="Descuento por retardo grave"
              hint="Días que descuenta cada retardo grave."
              value={`${settings.dias_descuento_retardo_grave} ${settings.dias_descuento_retardo_grave === 1 ? "día" : "días"}`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
              Escalones de acumulación por frecuencia
            </span>
            <ul className="flex flex-col gap-1.5">
              {frequencyOptions.map((frequency) => {
                const frequencyTiers = settings.tiers.filter(
                  (tier) => tier.id_payment_period === frequency.id_payment_period,
                );
                return (
                  <li key={frequency.id_payment_period} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                    <span className="w-28 shrink-0 font-semibold text-[#0b1c30] dark:text-zinc-100">
                      {frequency.description}
                    </span>
                    <span className="tabular-nums text-[#44474f] dark:text-zinc-300">
                      {frequencyTiers.length === 0
                        ? "Sin escalones: solo descuentan los graves"
                        : describeLatenessTiers(frequencyTiers)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="text-xs text-[#44474f] dark:text-zinc-400">
            Modificado por{" "}
            <span className="font-medium text-[#0b1c30] dark:text-zinc-100">
              {settings.updated_by_name || "un usuario desconocido"}
            </span>{" "}
            el {formatDateTimeSlashed(settings.updated_at)}
          </p>
        </div>
      )}
    </div>
  );
}
