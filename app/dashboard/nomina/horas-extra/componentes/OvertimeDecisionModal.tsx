"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Undo2, X } from "lucide-react";
import type { IOvertimeDayRow } from "@/interfaces/payroll_overtime";
import { weekdayOfDate } from "@/lib/payroll/overtimeDetection";
import { formatOvertimeDate, formatOvertimeHours, formatScheduledDay } from "@/lib/payroll/overtimeFormat";
import { clearOvertimeDecision, decideOvertimeDay } from "../actions";

type DecisionAction = "authorize" | "reject" | "clear";

interface ModalProps {
  dayRow: IOvertimeDayRow;
  idPeriod: number;
  /** Tope vigente de horas por día; null si la empresa aún no lo configura (el servidor lo vuelve a validar). */
  dailyCap: number | null;
  onClose: () => void;
}

const FIELD_CLASSES =
  "w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all";

const MAX_COMMENT_LENGTH = 500;

/** Horas en pasos de media hora (2, 2.5, 3…), o null si el texto no lo es. */
function parseHalfHours(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const hours = Number(trimmed);
  return Number.isInteger(hours * 2) ? hours : null;
}

function initialHoursText(dayRow: IOvertimeDayRow): string {
  if (dayRow.authorizedHours !== null) return String(dayRow.authorizedHours);
  // Lo detectado es solo una sugerencia; el admin puede autorizar más o menos.
  return dayRow.detectedHours > 0 ? String(dayRow.detectedHours) : "";
}

function DaySummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-[#0b1c30] dark:text-zinc-100">{value}</dd>
    </div>
  );
}

function OvertimeDecisionModal({ dayRow, idPeriod, dailyCap, onClose }: ModalProps) {
  const router = useRouter();
  const [hoursText, setHoursText] = useState(initialHoursText(dayRow));
  const [commentText, setCommentText] = useState(dayRow.comentario ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runningAction, setRunningAction] = useState<DecisionAction | null>(null);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const isBusy = runningAction !== null;
  const target = { id_period: idPeriod, id_empleado: dayRow.id_empleado, fecha: dayRow.fecha };

  async function runAction(action: DecisionAction) {
    setErrorMessage(null);

    if (action === "authorize") {
      const authorizedHours = parseHalfHours(hoursText);
      if (authorizedHours === null) {
        setErrorMessage("Captura las horas en pasos de 0.5 (por ejemplo, 2 o 2.5).");
        return;
      }
      if (authorizedHours <= 0) {
        setErrorMessage("Las horas autorizadas deben ser mayores a 0");
        return;
      }
      if (dailyCap !== null && authorizedHours > dailyCap) {
        setErrorMessage(`Máximo ${dailyCap} h por día`);
        return;
      }
    }
    if (commentText.trim().length > MAX_COMMENT_LENGTH) {
      setErrorMessage(`El comentario admite máximo ${MAX_COMMENT_LENGTH} caracteres`);
      return;
    }

    setRunningAction(action);
    try {
      const comment = commentText.trim() || undefined;
      const result =
        action === "clear"
          ? await clearOvertimeDecision(target)
          : action === "authorize"
            ? await decideOvertimeDay({
                ...target,
                decision: "authorized",
                horas_autorizadas: parseHalfHours(hoursText),
                comentario: comment,
              })
            : await decideOvertimeDay({ ...target, decision: "rejected", comentario: comment });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al guardar la decisión");
    } finally {
      setRunningAction(null);
    }
  }

  // Portal al body: el botón vive dentro de una celda con `text-right` que el diálogo no debe heredar.
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
        aria-labelledby="overtime-decision-modal-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 shrink-0 rounded-lg bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center">
              <ClipboardCheck size={18} />
            </span>
            <div className="min-w-0">
              <h3 id="overtime-decision-modal-title" className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
                Decidir horas extra
              </h3>
              <p className="text-sm text-[#44474f] dark:text-zinc-400 truncate">{dayRow.nombre_completo}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-[#747780] hover:text-[#0b1c30] dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-4 rounded-lg bg-[#eff4ff] dark:bg-zinc-800/60 px-4 py-3">
            <DaySummaryItem label="Día" value={formatOvertimeDate(dayRow.fecha, weekdayOfDate(dayRow.fecha))} />
            <DaySummaryItem
              label="Horario"
              value={dayRow.scheduledDay ? formatScheduledDay(dayRow.scheduledDay) : "Descanso"}
            />
            <DaySummaryItem
              label="Checadas"
              value={`${dayRow.firstCheckIn ?? "—"} → ${dayRow.lastCheckOut ?? "—"}`}
            />
            <DaySummaryItem label="Detectadas" value={formatOvertimeHours(dayRow.detectedHours)} />
          </dl>
          {dayRow.isIncomplete && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              La checada de este día está incompleta, por eso no se detectaron horas. Captura las que corresponden.
            </p>
          )}

          {errorMessage && (
            <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
            Horas a autorizar
            <input
              type="number"
              inputMode="decimal"
              min={0.5}
              max={dailyCap ?? undefined}
              step={0.5}
              autoFocus
              value={hoursText}
              onChange={(event) => setHoursText(event.target.value)}
              disabled={isBusy}
              className={FIELD_CLASSES}
            />
            <span className="text-xs font-normal text-[#747780] dark:text-zinc-500">
              En pasos de 0.5{dailyCap !== null ? `, hasta ${formatOvertimeHours(dailyCap)} por día` : ""}. Pueden ser
              más o menos que las detectadas.
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
            <span>
              Comentario <span className="font-normal text-[#747780] dark:text-zinc-500">(opcional)</span>
            </span>
            <textarea
              rows={3}
              maxLength={MAX_COMMENT_LENGTH}
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              disabled={isBusy}
              className={`${FIELD_CLASSES} resize-none`}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {dayRow.status !== "pending" ? (
              <button
                type="button"
                onClick={() => runAction("clear")}
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Undo2 size={16} aria-hidden />
                {runningAction === "clear" ? "Guardando…" : "Volver a pendiente"}
              </button>
            ) : (
              <span aria-hidden />
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => runAction("reject")}
                disabled={isBusy}
                className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-5 py-2.5 text-sm font-semibold text-[#ba1a1a] dark:text-red-400 hover:bg-[#ba1a1a]/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {runningAction === "reject" ? "Guardando…" : "Rechazar"}
              </button>
              <button
                type="button"
                onClick={() => runAction("authorize")}
                disabled={isBusy}
                className="rounded-lg bg-[#0051d5] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {runningAction === "authorize" ? "Guardando…" : "Autorizar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface ButtonProps {
  dayRow: IOvertimeDayRow;
  idPeriod: number;
  dailyCap: number | null;
}

/** Botón por fila: abre el modal de decisión. Solo se renderiza si el periodo admite cambios. */
export function DecideOvertimeButton({ dayRow, idPeriod, dailyCap }: ButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`${dayRow.status === "pending" ? "Decidir" : "Cambiar decisión de"} horas extra de ${dayRow.nombre_completo}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-3 py-1.5 text-xs font-semibold text-[#0051d5] dark:text-blue-300 hover:bg-[#dce9ff] dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
      >
        <ClipboardCheck size={14} aria-hidden />
        {dayRow.status === "pending" ? "Decidir" : "Cambiar"}
      </button>
      {isOpen && <OvertimeDecisionModal dayRow={dayRow} idPeriod={idPeriod} dailyCap={dailyCap} onClose={closeModal} />}
    </>
  );
}
