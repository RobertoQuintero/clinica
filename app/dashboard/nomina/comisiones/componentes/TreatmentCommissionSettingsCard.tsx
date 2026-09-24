import type { ReactNode } from "react";
import { Stethoscope } from "lucide-react";
import type { ITreatmentCommissionSettings } from "@/interfaces/payroll_treatment_commission";
import { formatDateTimeSlashed, formatPayrollCurrency } from "@/lib/payroll/moneyFormat";

interface Props {
  settings: ITreatmentCommissionSettings | null;
  /** Botón "Editar" (paso 5): la tarjeta lo aloja en su encabezado. */
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

export default function TreatmentCommissionSettingsCard({ settings, editAction }: Props) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 py-4 bg-[#eff4ff] dark:bg-zinc-800 border-b border-[#c4c6d0] dark:border-zinc-700">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-[#dce9ff] dark:bg-zinc-700 text-[#0051d5] dark:text-blue-300 flex items-center justify-center">
            <Stethoscope size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">
              Comisión por tratamiento de onicomicosis
            </h3>
            <p className="text-sm text-[#44474f] dark:text-zinc-400">
              Importe fijo por cada tratamiento que se termina de pagar dentro del periodo.
            </p>
          </div>
        </div>
        {editAction}
      </div>

      {settings === null ? (
        <p className="px-6 py-8 text-center text-[#747780] dark:text-zinc-500">
          Sin configurar, no se paga comisión por tratamientos
        </p>
      ) : (
        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <SettingValue
              label="Importe por tratamiento"
              hint="Se paga una sola vez por tratamiento."
              value={formatPayrollCurrency(settings.importe_por_tratamiento)}
            />
            <SettingValue
              label="Umbral de liquidación"
              hint="Suma de pagos parciales con la que el tratamiento se considera pagado."
              value={formatPayrollCurrency(settings.umbral_liquidacion)}
            />
          </div>
          <p className="text-xs text-[#44474f] dark:text-zinc-400">
            Modificado por{" "}
            <span className="font-medium text-[#0b1c30] dark:text-zinc-100">
              {settings.updated_by_nombre || "un usuario desconocido"}
            </span>{" "}
            el {formatDateTimeSlashed(settings.updated_at)}
          </p>
        </div>
      )}
    </div>
  );
}
