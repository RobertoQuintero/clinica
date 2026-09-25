import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import type { IOvertimeSettings } from "@/interfaces/payroll_overtime";
import { formatDateTimeSlashed } from "@/lib/payroll/moneyFormat";
import { formatOvertimeHours } from "@/lib/payroll/overtimeFormat";

interface Props {
  settings: IOvertimeSettings | null;
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

export default function OvertimeSettingsCard({ settings, editAction }: Props) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 py-4 bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-[#dce9ff] dark:bg-zinc-700 text-[#0051d5] dark:text-blue-300 flex items-center justify-center">
            <Clock size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">Límites de horas extra</h3>
            <p className="text-sm text-[#44474f] dark:text-zinc-400">
              Se aplican a toda la empresa y a las autorizaciones nuevas.
            </p>
          </div>
        </div>
        {editAction}
      </div>

      {settings === null ? (
        <p className="px-6 py-8 text-center text-[#747780] dark:text-zinc-500">
          Sin configurar, no se pueden autorizar horas extra
        </p>
      ) : (
        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <SettingValue
              label="Límite de horas dobles por periodo"
              hint="Las horas autorizadas por encima de este límite se pagarán triples."
              value={formatOvertimeHours(settings.limite_horas_dobles_periodo)}
            />
            <SettingValue
              label="Tope de horas por día"
              hint="Máximo que se puede autorizar a un empleado en un solo día."
              value={formatOvertimeHours(settings.tope_horas_dia)}
            />
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
