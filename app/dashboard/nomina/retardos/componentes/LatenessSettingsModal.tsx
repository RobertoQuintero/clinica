"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AlarmClock, Info, Pencil, Plus, Trash2, X } from "lucide-react";
import type { ILatenessFrequencyOption, ILatenessSettings } from "@/interfaces/payroll_lateness";
import { updateLatenessSettings } from "../actions";

interface ModalProps {
  settings: ILatenessSettings | null;
  frequencyOptions: ILatenessFrequencyOption[];
  onClose: () => void;
}

/** Un renglón del editor; los valores viajan como texto hasta que se guardan. */
interface ITierDraft {
  draftKey: number;
  id_payment_period: number;
  retardosText: string;
  daysText: string;
}

const FIELD_CLASSES =
  "w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all";

const SEVERE_DAYS_OPTIONS = [0.5, 1];

/** Entero positivo, o null si el texto no lo es. */
function parsePositiveInteger(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

/** Días en pasos de 0.5 mayores a 0, o null si el texto no lo es. */
function parseHalfDays(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 && Number.isInteger(value * 2) ? value : null;
}

function LatenessSettingsModal({ settings, frequencyOptions, onClose }: ModalProps) {
  const router = useRouter();
  const nextDraftKey = useRef(settings?.tiers.length ?? 0);
  const [toleranceText, setToleranceText] = useState(settings ? String(settings.tolerancia_minutos) : "");
  const [severeMinutesText, setSevereMinutesText] = useState(settings ? String(settings.minutos_retardo_grave) : "");
  const [severeDays, setSevereDays] = useState(settings ? settings.dias_descuento_retardo_grave : 0.5);
  const [tierDrafts, setTierDrafts] = useState<ITierDraft[]>(() =>
    (settings?.tiers ?? []).map((tier, tierIndex) => ({
      draftKey: tierIndex,
      id_payment_period: tier.id_payment_period,
      retardosText: String(tier.retardos),
      daysText: String(tier.dias_descuento),
    })),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, isSaving]);

  function addTier(idPaymentPeriod: number) {
    setTierDrafts((currentDrafts) => [
      ...currentDrafts,
      { draftKey: nextDraftKey.current++, id_payment_period: idPaymentPeriod, retardosText: "", daysText: "" },
    ]);
  }

  function updateTier(draftKey: number, changes: Partial<Pick<ITierDraft, "retardosText" | "daysText">>) {
    setTierDrafts((currentDrafts) =>
      currentDrafts.map((draft) => (draft.draftKey === draftKey ? { ...draft, ...changes } : draft)),
    );
  }

  function removeTier(draftKey: number) {
    setTierDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.draftKey !== draftKey));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const tolerance = parsePositiveInteger(toleranceText);
    const severeMinutes = parsePositiveInteger(severeMinutesText);
    if (tolerance === null || severeMinutes === null) {
      setErrorMessage("Captura la tolerancia y el umbral del retardo grave en minutos enteros mayores a 0.");
      return;
    }

    const tiers = [];
    for (const draft of tierDrafts) {
      const retardos = parsePositiveInteger(draft.retardosText);
      const diasDescuento = parseHalfDays(draft.daysText);
      if (retardos === null || diasDescuento === null) {
        setErrorMessage("Cada escalón necesita un número de retardos entero y días de descuento en pasos de 0.5.");
        return;
      }
      tiers.push({ id_payment_period: draft.id_payment_period, retardos, dias_descuento: diasDescuento });
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result = await updateLatenessSettings({
        tolerancia_minutos: tolerance,
        minutos_retardo_grave: severeMinutes,
        dias_descuento_retardo_grave: severeDays,
        tiers,
      });
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
        aria-labelledby="lateness-settings-modal-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center">
              <AlarmClock size={18} />
            </span>
            <h3 id="lateness-settings-modal-title" className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
              Reglas de retardos
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

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {errorMessage && (
            <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
              Tolerancia (min)
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                required
                autoFocus
                value={toleranceText}
                onChange={(event) => setToleranceText(event.target.value)}
                className={FIELD_CLASSES}
              />
              <span className="text-xs font-normal text-[#747780] dark:text-zinc-500">
                Es retardo a partir del minuto tolerancia + 1.
              </span>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
              Retardo grave desde (min)
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                required
                value={severeMinutesText}
                onChange={(event) => setSevereMinutesText(event.target.value)}
                className={FIELD_CLASSES}
              />
              <span className="text-xs font-normal text-[#747780] dark:text-zinc-500">
                Debe ser mayor a la tolerancia.
              </span>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
              Descuento por grave
              <select
                value={severeDays}
                onChange={(event) => setSevereDays(Number(event.target.value))}
                className={FIELD_CLASSES}
              >
                {SEVERE_DAYS_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {days} {days === 1 ? "día" : "días"}
                  </option>
                ))}
              </select>
              <span className="text-xs font-normal text-[#747780] dark:text-zinc-500">
                Por cada retardo grave.
              </span>
            </label>
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
              Escalones de acumulación por frecuencia
            </legend>
            <p className="text-xs text-[#747780] dark:text-zinc-500">
              Los retardos acumulables del periodo se descuentan en ciclo con el escalón más alto: con 1 → 0.5 y 2 → 1,
              tres retardos descuentan 1.5 días. Los días no pueden bajar cuando aumentan los retardos.
            </p>

            {frequencyOptions.map((frequency) => {
              const frequencyDrafts = tierDrafts.filter((draft) => draft.id_payment_period === frequency.id_payment_period);
              return (
                <div
                  key={frequency.id_payment_period}
                  className="rounded-lg border border-[#c4c6d0] dark:border-zinc-700 p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
                      {frequency.description}
                    </span>
                    <button
                      type="button"
                      onClick={() => addTier(frequency.id_payment_period)}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-3 py-1.5 text-xs font-semibold text-[#0051d5] dark:text-blue-300 hover:bg-[#dce9ff] dark:hover:bg-zinc-800 transition-colors disabled:opacity-60"
                    >
                      <Plus size={14} aria-hidden />
                      Agregar escalón
                    </button>
                  </div>

                  {frequencyDrafts.length === 0 ? (
                    <p className="text-xs text-[#747780] dark:text-zinc-500">
                      Sin escalones: en esta frecuencia solo descuentan los retardos graves.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {frequencyDrafts.map((draft) => (
                        <li key={draft.draftKey} className="flex items-end gap-3">
                          <label className="flex flex-col gap-1 text-xs font-semibold text-[#44474f] dark:text-zinc-300 flex-1">
                            Retardos
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              step={1}
                              required
                              value={draft.retardosText}
                              onChange={(event) => updateTier(draft.draftKey, { retardosText: event.target.value })}
                              className={FIELD_CLASSES}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-semibold text-[#44474f] dark:text-zinc-300 flex-1">
                            Días a descontar
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0.5}
                              step={0.5}
                              required
                              value={draft.daysText}
                              onChange={(event) => updateTier(draft.draftKey, { daysText: event.target.value })}
                              className={FIELD_CLASSES}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => removeTier(draft.draftKey)}
                            disabled={isSaving}
                            aria-label={`Quitar escalón de ${frequency.description}`}
                            className="mb-1 p-2 rounded-lg text-[#ba1a1a] hover:bg-[#ba1a1a]/10 transition-colors disabled:opacity-60"
                          >
                            <Trash2 size={16} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </fieldset>

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

export function EditLatenessSettingsButton({
  settings,
  frequencyOptions,
}: {
  settings: ILatenessSettings | null;
  frequencyOptions: ILatenessFrequencyOption[];
}) {
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
      {isOpen && <LatenessSettingsModal settings={settings} frequencyOptions={frequencyOptions} onClose={closeModal} />}
    </>
  );
}
