import { CalendarCheck2 } from "lucide-react";
import type { IPayrollPeriodRow } from "@/interfaces/payroll_period";
import { daysFromTo, formatPeriodDate, formatPeriodDayMonth, formatPeriodRange } from "@/lib/payroll/periodFormat";
import { PayrollFrequencyBadge } from "./PayrollBadges";

interface Props {
  activePeriod: IPayrollPeriodRow | null;
  today: string;
}

function positionPercent(period: IPayrollPeriodRow, targetDate: string): number {
  const totalDays = Math.max(1, daysFromTo(period.fecha_inicio, period.fecha_fin));
  const offset = daysFromTo(period.fecha_inicio, targetDate);
  return Math.min(100, Math.max(0, (offset / totalDays) * 100));
}

/** Tarjeta "Periodo activo en curso": la línea de tiempo ubica corte, pago y hoy dentro del rango. */
export default function ActivePayrollPeriodCard({ activePeriod, today }: Props) {
  if (!activePeriod) {
    return (
      <section className="bg-white dark:bg-zinc-900 border border-dashed border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-5 flex items-center gap-4">
        <span className="w-10 h-10 rounded-full bg-[#eff4ff] dark:bg-zinc-800 flex items-center justify-center text-[#747780] dark:text-zinc-500">
          <CalendarCheck2 size={20} />
        </span>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            Periodo activo en curso
          </h3>
          <p className="text-sm text-[#0b1c30] dark:text-zinc-100 mt-0.5">
            Ningún periodo de esta sucursal incluye la fecha de hoy.
          </p>
          <p className="text-xs text-[#747780] dark:text-zinc-500">Crea el siguiente con “Nuevo periodo de nómina”.</p>
        </div>
      </section>
    );
  }

  const milestones = [
    { key: "corte", label: "Corte", date: activePeriod.fecha_corte },
    { key: "pago", label: "Pago", date: activePeriod.fecha_pago },
  ];
  const todayPercent = positionPercent(activePeriod, today);

  return (
    <section className="bg-white dark:bg-zinc-900 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            Periodo activo en curso
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xl font-semibold text-[#0b1c30] dark:text-zinc-50">{activePeriod.codigo}</span>
            <PayrollFrequencyBadge description={activePeriod.frecuencia_descripcion} />
          </div>
          <p className="text-sm text-[#44474f] dark:text-zinc-400 mt-1">
            {formatPeriodRange(activePeriod.fecha_inicio, activePeriod.fecha_fin)}
          </p>
        </div>
        <p className="text-sm text-[#44474f] dark:text-zinc-400 sm:text-right">
          Pago el <strong className="text-[#0b1c30] dark:text-zinc-100">{formatPeriodDate(activePeriod.fecha_pago)}</strong>
        </p>
      </div>

      <div className="mt-6 mb-7 px-1">
        <div className="relative h-1.5 rounded-full bg-[#eff4ff] dark:bg-zinc-800">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[#0051d5]"
            style={{ width: `${todayPercent}%` }}
          />
          {milestones.map((milestone) => (
            <div
              key={milestone.key}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{ left: `${positionPercent(activePeriod, milestone.date)}%` }}
            >
              <span className="w-3 h-3 rounded-full border-2 border-[#0051d5] bg-white dark:bg-zinc-900" />
              <span className="absolute top-4 whitespace-nowrap text-[11px] text-[#44474f] dark:text-zinc-400">
                {milestone.label} · {formatPeriodDayMonth(milestone.date)}
              </span>
            </div>
          ))}
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${todayPercent}%` }}
            aria-label="Hoy"
          >
            <span className="block w-3.5 h-3.5 rounded-full bg-[#0051d5] ring-4 ring-[#0051d5]/20" />
          </div>
        </div>
        <div className="flex justify-between mt-9 text-[11px] font-semibold uppercase tracking-wide text-[#747780] dark:text-zinc-500">
          <span>Inicio · {formatPeriodDayMonth(activePeriod.fecha_inicio)}</span>
          <span>Fin · {formatPeriodDayMonth(activePeriod.fecha_fin)}</span>
        </div>
      </div>
    </section>
  );
}
