"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Award, Info, Pencil, X } from "lucide-react";
import type { BonusKind, IBonusSetting } from "@/interfaces/payroll_bonus";
import { updatePunctualityBonusSettings } from "../actions";

interface ModalProps {
  bonusKind: BonusKind;
  settings: IBonusSetting[];
  onClose: () => void;
}

const BONUS_COPY: Record<BonusKind, { title: string; help: string }> = {
  punctuality: {
    title: "Reglas del bono de puntualidad",
    help: "Deja vacío el monto y el máximo de una frecuencia que aún no paga bono. Un podólogo conserva el bono si sus retardos más faltas injustificados no pasan del máximo.",
  },
  attendance: {
    title: "Reglas del bono de asistencia",
    help: "Deja vacío el monto de una frecuencia que aún no paga bono. Un podólogo conserva el bono solo si no tiene ninguna falta injustificada en el periodo.",
  },
};

/** Un renglón del editor por frecuencia; los valores viajan como texto hasta que se guardan. */
interface IFrequencyDraft {
  id_payment_period: number;
  frequencyName: string;
  hasStoredRow: boolean;
  amountText: string;
  maximumText: string;
  isActive: boolean;
}

const FIELD_CLASSES =
  "w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all";

/** Monto positivo con 2 decimales como máximo, o null si el texto no lo es. */
function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

/** Entero mayor o igual a 0, o null si el texto no lo es. */
function parseNonNegativeInteger(text: string): number | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

function buildDrafts(settings: IBonusSetting[]): IFrequencyDraft[] {
  return settings.map((setting) => {
    const hasStoredRow = setting.updated_at !== null;
    return {
      id_payment_period: setting.id_payment_period,
      frequencyName: setting.frequencyName,
      hasStoredRow,
      amountText: hasStoredRow ? String(setting.monto) : "",
      maximumText: hasStoredRow ? String(setting.maximo_incidencias ?? "") : "",
      isActive: hasStoredRow ? setting.status : true,
    };
  });
}

function BonusSettingsModal({ bonusKind, settings, onClose }: ModalProps) {
  const router = useRouter();
  const hasMaximumField = bonusKind === "punctuality";
  const copy = BONUS_COPY[bonusKind];
  const [drafts, setDrafts] = useState<IFrequencyDraft[]>(() => buildDrafts(settings));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, isSaving]);

  function updateDraft(idPaymentPeriod: number, changes: Partial<Pick<IFrequencyDraft, "amountText" | "maximumText" | "isActive">>) {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) => (draft.id_payment_period === idPaymentPeriod ? { ...draft, ...changes } : draft)),
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const settingsToSave = [];
    for (const draft of drafts) {
      const isUntouched = draft.amountText.trim() === "" && (!hasMaximumField || draft.maximumText.trim() === "");
      // Una frecuencia sin configuración y sin captura se queda sin bono: no se manda.
      if (!draft.hasStoredRow && isUntouched) continue;

      const amount = parseAmount(draft.amountText);
      const maximumIncidents = hasMaximumField ? parseNonNegativeInteger(draft.maximumText) : null;
      if (amount === null) {
        setErrorMessage(`${draft.frequencyName}: captura un monto mayor a 0 con máximo 2 decimales.`);
        return;
      }
      if (hasMaximumField && maximumIncidents === null) {
        setErrorMessage(`${draft.frequencyName}: captura el máximo de incidencias como un entero de 0 o más.`);
        return;
      }
      settingsToSave.push({
        id_payment_period: draft.id_payment_period,
        monto: amount,
        ...(hasMaximumField ? { maximo_incidencias: maximumIncidents } : {}),
        status: draft.isActive,
      });
    }

    if (settingsToSave.length === 0) {
      setErrorMessage(
        hasMaximumField
          ? "Captura el monto y el máximo de al menos una frecuencia."
          : "Captura el monto de al menos una frecuencia.",
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result = await updatePunctualityBonusSettings({ settings: settingsToSave });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al guardar las reglas");
    } finally {
      setIsSaving(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bonus-settings-modal-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center">
              <Award size={18} />
            </span>
            <h3
              id="bonus-settings-modal-title"
              className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50"
            >
              {copy.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Cerrar"
            className="text-[#747780] hover:text-[#0b1c30] dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-60"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 flex flex-col gap-5">
          {errorMessage && (
            <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          )}

          <p className="text-xs text-[#747780] dark:text-zinc-500">{copy.help}</p>

          <ul className="flex flex-col gap-3">
            {drafts.map((draft, draftIndex) => (
              <li
                key={draft.id_payment_period}
                className="rounded-lg border border-[#c4c6d0] dark:border-zinc-700 p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">{draft.frequencyName}</span>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#44474f] dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={draft.isActive}
                      onChange={(event) => updateDraft(draft.id_payment_period, { isActive: event.target.checked })}
                      disabled={isSaving}
                      className="h-4 w-4 accent-[#0051d5]"
                    />
                    {draft.isActive ? "Activo" : "Inactivo"}
                  </label>
                </div>
                <div className={`grid grid-cols-1 gap-4 ${hasMaximumField ? "sm:grid-cols-2" : ""}`}>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-[#44474f] dark:text-zinc-300">
                    Monto del bono
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0.01}
                      step={0.01}
                      autoFocus={draftIndex === 0}
                      value={draft.amountText}
                      onChange={(event) => updateDraft(draft.id_payment_period, { amountText: event.target.value })}
                      className={FIELD_CLASSES}
                    />
                  </label>
                  {hasMaximumField && (
                    <label className="flex flex-col gap-1 text-xs font-semibold text-[#44474f] dark:text-zinc-300">
                      Máximo de incidencias
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={draft.maximumText}
                        onChange={(event) => updateDraft(draft.id_payment_period, { maximumText: event.target.value })}
                        className={FIELD_CLASSES}
                      />
                    </label>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <p className="flex items-start gap-2 rounded-lg bg-[#eff4ff] dark:bg-zinc-800/60 px-4 py-3 text-xs text-[#44474f] dark:text-zinc-300">
            <Info size={16} className="mt-px shrink-0 text-[#0051d5] dark:text-blue-300" aria-hidden />
            El cambio aplica a todos los periodos que aún no se aprueban. Si un periodo ya está en cálculo, tendrás que
            recalcularlo.
          </p>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors disabled:opacity-60"
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
    </div>,
    document.body,
  );
}

export function EditBonusSettingsButton({ bonusKind, settings }: { bonusKind: BonusKind; settings: IBonusSetting[] }) {
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
        Editar
      </button>
      {isOpen && <BonusSettingsModal bonusKind={bonusKind} settings={settings} onClose={closeModal} />}
    </>
  );
}
