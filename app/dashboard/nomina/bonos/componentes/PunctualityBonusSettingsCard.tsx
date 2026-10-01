import type { ReactNode } from "react";
import { Award } from "lucide-react";
import type { IPunctualityBonusSetting } from "@/interfaces/payroll_punctuality_bonus";
import { formatDateTimeSlashed, formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

interface Props {
  settings: IPunctualityBonusSetting[];
  /** Botón "Editar": la tarjeta lo aloja en su encabezado. */
  editAction?: ReactNode;
}

const ACTIVE_BADGE_CLASSES =
  "bg-[#009c6b]/10 text-[#009c6b] border-[#009c6b]/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
const INACTIVE_BADGE_CLASSES =
  "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";

function formatIncidentLimit(maximumIncidents: number): string {
  return maximumIncidents === 1 ? "1 incidencia" : `${maximumIncidents} incidencias`;
}

/** Una fila por frecuencia activa, tenga o no configuración. Sin fila no hay bono para esa frecuencia. */
export default function PunctualityBonusSettingsCard({ settings, editAction }: Props) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 py-4 bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-[#dce9ff] dark:bg-zinc-700 text-[#0051d5] dark:text-blue-300 flex items-center justify-center">
            <Award size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">Reglas del bono de puntualidad</h3>
            <p className="text-sm text-[#44474f] dark:text-zinc-400">
              Cada frecuencia de pago tiene su propio monto y su máximo de incidencias (retardos más faltas).
            </p>
          </div>
        </div>
        {editAction}
      </div>

      {settings.length === 0 ? (
        <p className="px-6 py-8 text-center text-[#747780] dark:text-zinc-500">
          No hay frecuencias de pago activas para configurar
        </p>
      ) : (
        <ul className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
          {settings.map((setting) => {
            const isConfigured = setting.updated_at !== null;
            return (
              <li
                key={setting.id_payment_period}
                className="px-6 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-1.5"
              >
                <span className="w-28 shrink-0 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
                  {setting.frequencyName}
                </span>
                {isConfigured ? (
                  <>
                    <span className="text-sm tabular-nums text-[#0b1c30] dark:text-zinc-100">
                      <span className="font-semibold">{formatPayrollCurrency(setting.monto)}</span>
                      <span className="text-[#44474f] dark:text-zinc-400">
                        {" "}
                        si tiene hasta {formatIncidentLimit(setting.maximo_incidencias)}
                      </span>
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        setting.status ? ACTIVE_BADGE_CLASSES : INACTIVE_BADGE_CLASSES
                      }`}
                    >
                      {setting.status ? "Activo" : "Inactivo"}
                    </span>
                    <span className="text-xs text-[#44474f] dark:text-zinc-400 sm:ml-auto">
                      Modificado por{" "}
                      <span className="font-medium text-[#0b1c30] dark:text-zinc-100">
                        {setting.updated_by_name || "un usuario desconocido"}
                      </span>{" "}
                      el {formatDateTimeSlashed(setting.updated_at!)}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-[#747780] dark:text-zinc-500">Sin bono configurado</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
