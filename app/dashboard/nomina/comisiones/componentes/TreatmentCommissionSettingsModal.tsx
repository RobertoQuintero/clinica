"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Pencil, Stethoscope, X } from "lucide-react";
import type { ITreatmentCommissionSettings } from "@/interfaces/payroll_treatment_commission";
import { updateTreatmentCommissionSettings } from "../actions";

interface ModalProps {
  settings: ITreatmentCommissionSettings | null;
  onClose: () => void;
}

const FIELD_CLASSES =
  "w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all";

/** Monto con hasta dos decimales, o null si el texto no lo es. */
function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Number(trimmed);
}

function TreatmentCommissionSettingsModal({ settings, onClose }: ModalProps) {
  const router = useRouter();
  const [unitAmountText, setUnitAmountText] = useState(
    settings ? String(settings.importe_por_tratamiento) : "",
  );
  const [thresholdText, setThresholdText] = useState(settings ? String(settings.umbral_liquidacion) : "");
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
    const unitAmount = parseAmount(unitAmountText);
    const threshold = parseAmount(thresholdText);
    if (unitAmount === null || threshold === null) {
      setErrorMessage("Captura el importe y el umbral con hasta dos decimales.");
      return;
    }
    if (threshold <= 0) {
      setErrorMessage("El umbral debe ser mayor a 0");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result = await updateTreatmentCommissionSettings({
        importe_por_tratamiento: unitAmount,
        umbral_liquidacion: threshold,
      });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al guardar la configuración");
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
        aria-labelledby="treatment-commission-modal-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center">
              <Stethoscope size={18} />
            </span>
            <h3
              id="treatment-commission-modal-title"
              className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50"
            >
              Comisión por tratamiento de onicomicosis
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
            Importe por tratamiento (MXN)
            <input
              type="text"
              inputMode="decimal"
              required
              autoFocus
              value={unitAmountText}
              onChange={(event) => setUnitAmountText(event.target.value)}
              className={FIELD_CLASSES}
            />
            <span className="text-xs font-normal text-[#747780] dark:text-zinc-500">
              Con 0 se deja de pagar la comisión sin borrar la configuración.
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
            Umbral de liquidación (MXN)
            <input
              type="text"
              inputMode="decimal"
              required
              value={thresholdText}
              onChange={(event) => setThresholdText(event.target.value)}
              className={FIELD_CLASSES}
            />
            <span className="text-xs font-normal text-[#747780] dark:text-zinc-500">
              Suma de pagos parciales con la que un tratamiento se considera pagado.
            </span>
          </label>

          <p className="flex items-start gap-2 rounded-lg bg-[#eff4ff] dark:bg-zinc-800/60 px-4 py-3 text-xs text-[#44474f] dark:text-zinc-300">
            <Info size={16} className="mt-px shrink-0 text-[#0051d5] dark:text-blue-300" aria-hidden />
            El cambio aplica al siguiente cálculo; las nóminas ya calculadas no cambian hasta que se recalculen
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

export function EditTreatmentCommissionSettingsButton({ settings }: { settings: ITreatmentCommissionSettings | null }) {
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
      {isOpen && <TreatmentCommissionSettingsModal settings={settings} onClose={closeModal} />}
    </>
  );
}
