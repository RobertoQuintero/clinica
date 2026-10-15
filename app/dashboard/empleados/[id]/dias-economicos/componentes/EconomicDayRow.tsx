import type { ReactNode } from "react";
import type { IEconomicDay } from "@/interfaces/economic_day";
import { formatEconomicDayDate } from "@/lib/economicDays/economicDayFormatting";
import { formatDateTimeForDisplay } from "@/lib/vacations/vacationFormatting";

interface Props {
  economicDay: IEconomicDay;
  /** Acciones de la fila (cancelar); solo en días activos del año en curso. */
  actions?: ReactNode;
}

export default function EconomicDayRow({ economicDay, actions }: Props) {
  const isCancelled = economicDay.cancelado_at !== null;

  return (
    <li className="px-5 py-4 flex flex-wrap items-start gap-x-6 gap-y-2">
      <div className="min-w-0 flex-1 basis-64">
        <p
          className={`text-sm font-semibold capitalize ${
            isCancelled
              ? "text-[#74777f] dark:text-zinc-500 line-through"
              : "text-[#0b1c30] dark:text-zinc-50"
          }`}
        >
          {formatEconomicDayDate(economicDay.fecha)}
        </p>
        <p className="text-sm text-[#44474f] dark:text-zinc-400 mt-0.5 break-words">
          {economicDay.motivo}
        </p>
        <p className="text-xs text-[#74777f] dark:text-zinc-500 mt-1">
          Registrado por {economicDay.created_by_name ?? "—"} el{" "}
          {formatDateTimeForDisplay(economicDay.created_at)}
        </p>
        {isCancelled && economicDay.cancelado_at && (
          <p className="text-xs text-[#ba1a1a] dark:text-red-400 mt-1 break-words">
            Cancelado por {economicDay.cancelado_by_name ?? "—"} el{" "}
            {formatDateTimeForDisplay(economicDay.cancelado_at)}: {economicDay.motivo_cancelacion}
          </p>
        )}
      </div>

      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          isCancelled
            ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
        }`}
      >
        {isCancelled ? "Cancelado" : "Registrado"}
      </span>

      {actions && <div className="flex gap-2">{actions}</div>}
    </li>
  );
}
