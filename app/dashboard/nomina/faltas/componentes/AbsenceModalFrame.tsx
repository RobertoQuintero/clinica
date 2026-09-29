"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { IAbsenceDayRow } from "@/interfaces/payroll_absence";
import { weekdayOfDate } from "@/lib/payroll/overtimeDetection";
import { formatOvertimeDate, formatScheduledDay } from "@/lib/payroll/overtimeFormat";

interface Props {
  titleId: string;
  title: string;
  icon: ReactNode;
  dayRow: IAbsenceDayRow;
  isBusy: boolean;
  onClose: () => void;
  children: ReactNode;
}

export const ABSENCE_FIELD_CLASSES =
  "w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all";

export const ABSENCE_MAX_COMMENT_LENGTH = 500;

/**
 * Marco compartido de los modales de Faltas: portal al body, cierre con Escape o clic fuera, encabezado con el
 * empleado y un resumen del día. El portal evita heredar el `text-right` de la celda donde vive el botón.
 */
export default function AbsenceModalFrame({ titleId, title, icon, dayRow, isBusy, onClose, children }: Props) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, isBusy]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 shrink-0 rounded-lg bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center">
              {icon}
            </span>
            <div className="min-w-0">
              <h3 id={titleId} className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
                {title}
              </h3>
              <p className="text-sm text-[#44474f] dark:text-zinc-400 truncate">{dayRow.nombre_completo}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Cerrar"
            className="text-[#747780] hover:text-[#0b1c30] dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-60"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-4 rounded-lg bg-[#eff4ff] dark:bg-zinc-800/60 px-4 py-3">
            <div className="flex flex-col gap-0.5 min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">Día</dt>
              <dd className="text-sm font-medium tabular-nums text-[#0b1c30] dark:text-zinc-100">
                {formatOvertimeDate(dayRow.fecha, weekdayOfDate(dayRow.fecha))}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
                Horario
              </dt>
              <dd className="text-sm font-medium tabular-nums text-[#0b1c30] dark:text-zinc-100">
                {formatScheduledDay(dayRow.scheduledDay)}
              </dd>
            </div>
          </dl>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
