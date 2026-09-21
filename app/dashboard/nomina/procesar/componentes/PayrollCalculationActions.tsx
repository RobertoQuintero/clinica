"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, RefreshCw, Undo2, type LucideIcon } from "lucide-react";
import type { PayrollPeriodStatus } from "@/interfaces/payroll_period";
import { calculatePayrollPeriod, revertPayrollCalculation } from "../actions";

interface Props {
  idPeriod: number;
  periodCode: string;
  status: PayrollPeriodStatus;
}

type CalculationAction = "calculate" | "recalculate" | "revert";

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
};

const ACTIONS_BY_STATUS: Partial<Record<PayrollPeriodStatus, CalculationAction[]>> = {
  1: ["calculate"],
  2: ["recalculate", "revert"],
};

const BUTTON_CLASSES = {
  primary: "bg-[#0051d5] text-white hover:bg-[#003ea7] border-transparent",
  secondary:
    "bg-white dark:bg-zinc-900 text-[#0b1c30] dark:text-zinc-100 border-[#c4c6d0] dark:border-zinc-600 hover:bg-[#eff4ff] dark:hover:bg-zinc-800",
};

/** Botones Calcular / Recalcular / Revertir según el estatus, con confirmación propia (sin `confirm()`). */
export default function PayrollCalculationActions({ idPeriod, periodCode, status }: Props) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<CalculationAction | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingAction || isRunning) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPendingAction(null);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [pendingAction, isRunning]);

  const availableActions = ACTIONS_BY_STATUS[status];
  if (!availableActions) return null;

  async function handleConfirm() {
    if (!pendingAction) return;
    setIsRunning(true);
    setErrorMessage(null);
    try {
      const input = { id_period: idPeriod };
      const result =
        pendingAction === "revert" ? await revertPayrollCalculation(input) : await calculatePayrollPeriod(input);
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

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {availableActions.map((action, index) => {
          const { buttonLabel, icon: ActionIcon } = ACTION_COPY[action];
          return (
            <button
              key={action}
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setPendingAction(action);
              }}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition-colors ${
                index === 0 ? BUTTON_CLASSES.primary : BUTTON_CLASSES.secondary
              }`}
            >
              <ActionIcon size={16} />
              {buttonLabel}
            </button>
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
                disabled={isRunning}
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
