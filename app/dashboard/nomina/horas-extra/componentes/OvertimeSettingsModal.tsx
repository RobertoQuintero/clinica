"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Info, Pencil, X } from "lucide-react";
import type { IOvertimeSettings } from "@/interfaces/payroll_overtime";
import { updateOvertimeSettings } from "../actions";

interface ModalProps {
  settings: IOvertimeSettings | null;
  onClose: () => void;
}

const FIELD_CLASSES =
  "w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all";

const MAX_HOURS_PER_DAY = 24;

/** Horas en pasos de media hora (2, 2.5, 3…), o null si el texto no lo es. */
function parseHalfHours(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const hours = Number(trimmed);
  return Number.isInteger(hours * 2) ? hours : null;
}

function OvertimeSettingsModal({ settings, onClose }: ModalProps) {
  const router = useRouter();
  const [doubleHoursLimitText, setDoubleHoursLimitText] = useState(
    settings ? String(settings.limite_horas_dobles_periodo) : "",
  );
  const [dailyCapText, setDailyCapText] = useState(settings ? String(settings.tope_horas_dia) : "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const doubleHoursLimit = parseHalfHours(doubleHoursLimitText);
    const dailyCap = parseHalfHours(dailyCapText);
    if (doubleHoursLimit === null || dailyCap === null) {
      setErrorMessage("Captura las horas en pasos de 0.5 (por ejemplo, 9 o 9.5).");
      return;
    }
    if (dailyCap <= 0 || dailyCap > MAX_HOURS_PER_DAY) {
      setErrorMessage(`El tope por día debe ser mayor a 0 y de máximo ${MAX_HOURS_PER_DAY} horas`);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result = await updateOvertimeSettings({
        limite_horas_dobles_periodo: doubleHoursLimit,
        tope_horas_dia: dailyCap,
      });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al guardar los límites");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="overtime-settings-modal-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center">
              <Clock size={18} />
            </span>
            <h3 id="overtime-settings-modal-title" className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
              Límites de horas extra
            </h3>
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

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {errorMessage && (
            <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
            Límite de horas dobles por periodo
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              required
              autoFocus
              value={doubleHoursLimitText}
              onChange={(event) => setDoubleHoursLimitText(event.target.value)}
              className={FIELD_CLASSES}
            />
            <span className="text-xs font-normal text-[#747780] dark:text-zinc-500">
              Las horas autorizadas por encima de este límite se pagarán triples.
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
            Tope de horas por día
            <input
              type="number"
              inputMode="decimal"
              min={0.5}
              max={MAX_HOURS_PER_DAY}
              step={0.5}
              required
              value={dailyCapText}
              onChange={(event) => setDailyCapText(event.target.value)}
              className={FIELD_CLASSES}
            />
            <span className="text-xs font-normal text-[#747780] dark:text-zinc-500">
              Máximo que se puede autorizar a un empleado en un solo día (hasta {MAX_HOURS_PER_DAY} h).
            </span>
          </label>

          <p className="flex items-start gap-2 rounded-lg bg-[#eff4ff] dark:bg-zinc-800/60 px-4 py-3 text-xs text-[#44474f] dark:text-zinc-300">
            <Info size={16} className="mt-px shrink-0 text-[#0051d5] dark:text-blue-300" aria-hidden />
            El cambio aplica a las autorizaciones nuevas; las que ya están guardadas no cambian.
          </p>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-[#0051d5] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EditOvertimeSettingsButton({ settings }: { settings: IOvertimeSettings | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex shrink-0 items-center gap-2 rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90"
      >
        <Pencil size={16} />
        {settings ? "Editar" : "Configurar"}
      </button>
      {isOpen && <OvertimeSettingsModal settings={settings} onClose={closeModal} />}
    </>
  );
}
