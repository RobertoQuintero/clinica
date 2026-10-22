"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Calculator, CheckCircle2, RefreshCw, RotateCcw, Undo2, type LucideIcon } from "lucide-react";
import type { PayrollPeriodStatus } from "@/interfaces/payroll_period";
import {
  PERIOD_NEEDS_RECALCULATION_MESSAGE,
  UNAPPROVE_COMMENT_MAX_LENGTH,
  UNAPPROVE_COMMENT_MIN_LENGTH,
} from "@/lib/payroll/periodStatus";
import { formatDateSlashed } from "@/lib/payroll/periodFormat";
import { addZeroToday } from "@/utils/date_helpper";
import {
  approvePayrollPeriod,
  calculatePayrollPeriod,
  payPayrollPeriod,
  revertPayrollCalculation,
  unapprovePayrollPeriod,
} from "../actions";

interface Props {
  idPeriod: number;
  periodCode: string;
  status: PayrollPeriodStatus;
  /** Spec 94: algún aviso "Recalcula" sigue activo; deshabilita Aprobar. */
  recalculationNeeded?: boolean;
  /** Spec 94: advertencias ámbar del modal de Aprobar (ISR/IMSS no calculado, periodo sin empleados). */
  warnings?: string[];
  /** Spec 94: fecha de pago del periodo ("YYYY-MM-DD"), para advertir en el modal de Pagar si aún no llega. */
  fechaPago?: string | null;
}

type CalculationAction = "calculate" | "recalculate" | "revert" | "approve" | "pay" | "unapprove";

interface ActionCopy {
  buttonLabel: string;
  icon: LucideIcon;
  title: (periodCode: string) => string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  errorFallback: string;
  isDestructive: boolean;
}

const ACTION_COPY: Record<CalculationAction, ActionCopy> = {
  calculate: {
    buttonLabel: "Calcular nómina",
    icon: Calculator,
    title: (periodCode) => `¿Calcular la nómina de ${periodCode}?`,
    description:
      "Se guarda el salario de cada empleado del periodo y el periodo pasa a En cálculo. Mientras esté en cálculo no se pueden editar sus fechas.",
    confirmLabel: "Calcular nómina",
    pendingLabel: "Calculando…",
    errorFallback: "Error inesperado al calcular la nómina",
    isDestructive: false,
  },
  recalculate: {
    buttonLabel: "Recalcular",
    icon: RefreshCw,
    title: (periodCode) => `¿Recalcular ${periodCode}?`,
    description:
      "Se reemplaza el cálculo guardado con los empleados y salarios actuales. Los importes anteriores se pierden.",
    confirmLabel: "Recalcular",
    pendingLabel: "Recalculando…",
    errorFallback: "Error inesperado al recalcular la nómina",
    isDestructive: false,
  },
  revert: {
    buttonLabel: "Revertir a Programada",
    icon: Undo2,
    title: (periodCode) => `¿Revertir ${periodCode} a Programada?`,
    description:
      "Se borra el cálculo guardado y el periodo vuelve a Programada para poder editar sus fechas. Puedes calcularlo de nuevo cuando quieras.",
    confirmLabel: "Revertir a Programada",
    pendingLabel: "Revirtiendo…",
    errorFallback: "Error inesperado al revertir el cálculo",
    isDestructive: true,
  },
  approve: {
    buttonLabel: "Aprobar",
    icon: CheckCircle2,
    title: (periodCode) => `¿Aprobar ${periodCode}?`,
    description:
      "Al aprobar, el cálculo queda congelado: ya no se podrá recalcular, revertir ni cambiar faltas, retardos u horas extra del periodo.",
    confirmLabel: "Aprobar",
    pendingLabel: "Aprobando…",
    errorFallback: "Error inesperado al aprobar el periodo",
    isDestructive: false,
  },
  pay: {
    buttonLabel: "Marcar como pagada",
    icon: Banknote,
    title: (periodCode) => `¿Marcar ${periodCode} como pagada?`,
    description: "Pagada es definitiva: el periodo no se podrá desaprobar ni revertir.",
    confirmLabel: "Marcar como pagada",
    pendingLabel: "Marcando…",
    errorFallback: "Error inesperado al marcar el periodo como pagada",
    isDestructive: false,
  },
  unapprove: {
    buttonLabel: "Desaprobar",
    icon: RotateCcw,
    title: (periodCode) => `¿Desaprobar ${periodCode}?`,
    description: "El periodo regresa a En cálculo y se podrá recalcular. Escribe el motivo.",
    confirmLabel: "Desaprobar",
    pendingLabel: "Desaprobando…",
    errorFallback: "Error inesperado al desaprobar el periodo",
    isDestructive: true,
  },
};

const ACTIONS_BY_STATUS: Partial<Record<PayrollPeriodStatus, CalculationAction[]>> = {
  1: ["calculate"],
  2: ["recalculate", "revert", "approve"],
  3: ["unapprove", "pay"],
  4: [],
};

const BUTTON_CLASSES = {
  primary: "bg-[#0051d5] text-white hover:bg-[#003ea7] border-transparent",
  secondary:
    "bg-white dark:bg-zinc-900 text-[#0b1c30] dark:text-zinc-100 border-[#c4c6d0] dark:border-zinc-600 hover:bg-[#eff4ff] dark:hover:bg-zinc-800",
};

/** Botones Calcular / Recalcular / Revertir / Aprobar / Marcar como pagada / Desaprobar según el estatus, con confirmación propia (sin `confirm()`). */
export default function PayrollCalculationActions({
  idPeriod,
  periodCode,
  status,
  recalculationNeeded = false,
  warnings = [],
  fechaPago = null,
}: Props) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<CalculationAction | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    if (!pendingAction || isRunning) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPendingAction(null);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [pendingAction, isRunning]);

  const availableActions = ACTIONS_BY_STATUS[status];
  if (!availableActions || availableActions.length === 0) return null;

  const trimmedComentario = comentario.trim();
  const isUnapproveCommentValid =
    trimmedComentario.length >= UNAPPROVE_COMMENT_MIN_LENGTH && trimmedComentario.length <= UNAPPROVE_COMMENT_MAX_LENGTH;

  // Spec 94: al pagar, advierte si la fecha de pago programada todavía no llega (no bloquea).
  const paymentDateWarning =
    fechaPago && fechaPago > addZeroToday(new Date())
      ? `La fecha de pago del periodo es el ${formatDateSlashed(fechaPago)}; aún no llega`
      : null;

  function openDialog(action: CalculationAction) {
    setErrorMessage(null);
    setComentario("");
    setPendingAction(action);
  }

  async function handleConfirm() {
    if (!pendingAction) return;
    if (pendingAction === "unapprove" && !isUnapproveCommentValid) return;
    setIsRunning(true);
    setErrorMessage(null);
    try {
      const input = { id_period: idPeriod };
      const result =
        pendingAction === "revert"
          ? await revertPayrollCalculation(input)
          : pendingAction === "approve"
            ? await approvePayrollPeriod(input)
            : pendingAction === "pay"
              ? await payPayrollPeriod(input)
              : pendingAction === "unapprove"
                ? await unapprovePayrollPeriod({ ...input, comentario: trimmedComentario })
                : await calculatePayrollPeriod(input);
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      setPendingAction(null);
      router.refresh();
    } catch {
      setErrorMessage(ACTION_COPY[pendingAction].errorFallback);
    } finally {
      setIsRunning(false);
    }
  }

  const pendingCopy = pendingAction ? ACTION_COPY[pendingAction] : null;
  const modalWarnings = pendingAction === "approve" ? warnings : pendingAction === "pay" && paymentDateWarning ? [paymentDateWarning] : [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {availableActions.map((action, index) => {
          const { buttonLabel, icon: ActionIcon } = ACTION_COPY[action];
          const isApproveBlocked = action === "approve" && recalculationNeeded;
          return (
            <div key={action} className="flex flex-col items-start gap-1.5">
              <button
                type="button"
                onClick={() => openDialog(action)}
                disabled={isApproveBlocked}
                aria-describedby={isApproveBlocked ? "payroll-approve-blocked-reason" : undefined}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  index === 0 ? BUTTON_CLASSES.primary : BUTTON_CLASSES.secondary
                }`}
              >
                <ActionIcon size={16} />
                {buttonLabel}
              </button>
              {isApproveBlocked && (
                <p id="payroll-approve-blocked-reason" className="max-w-xs text-xs text-[#44474f] dark:text-zinc-400">
                  {PERIOD_NEEDS_RECALCULATION_MESSAGE}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {pendingCopy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isRunning) setPendingAction(null);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="payroll-calculation-title"
            className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 p-6 text-left shadow-xl"
          >
            <h3 id="payroll-calculation-title" className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">
              {pendingCopy.title(periodCode)}
            </h3>
            <p className="mt-2 text-sm text-[#44474f] dark:text-zinc-400">{pendingCopy.description}</p>

            {modalWarnings.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-md bg-amber-50 dark:bg-amber-900/30 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
                {modalWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}

            {pendingAction === "unapprove" && (
              <div className="mt-3">
                <label htmlFor="payroll-unapprove-comentario" className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">
                  Motivo
                </label>
                <textarea
                  id="payroll-unapprove-comentario"
                  value={comentario}
                  onChange={(event) => setComentario(event.target.value)}
                  maxLength={UNAPPROVE_COMMENT_MAX_LENGTH}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100"
                />
                <p className="mt-1 text-xs text-[#747780] dark:text-zinc-500">
                  {trimmedComentario.length}/{UNAPPROVE_COMMENT_MAX_LENGTH} (mínimo {UNAPPROVE_COMMENT_MIN_LENGTH})
                </p>
              </div>
            )}

            {errorMessage && (
              <p role="alert" className="mt-3 rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {errorMessage}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                disabled={isRunning}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 disabled:opacity-60 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isRunning || (pendingAction === "unapprove" && !isUnapproveCommentValid)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 transition-colors ${
                  pendingCopy.isDestructive ? "bg-[#ba1a1a] hover:bg-[#ba1a1a]/90" : "bg-[#0051d5] hover:bg-[#003ea7]"
                }`}
              >
                {isRunning ? pendingCopy.pendingLabel : pendingCopy.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
