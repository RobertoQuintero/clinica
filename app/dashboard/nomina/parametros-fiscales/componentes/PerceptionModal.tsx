"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Scale, X } from "lucide-react";
import type { ExemptionLimitType, ExemptionPeriodicity, IPerception } from "@/interfaces/payroll_tax_parameters";
import { savePerception } from "../actions";

const FIELD_CLASSES =
  "w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all";

const LIMIT_TYPE_OPTIONS: { value: ExemptionLimitType; label: string; hint: string }[] = [
  { value: "N", label: "Sin exención", hint: "Todo el importe es gravado." },
  { value: "T", label: "Totalmente exenta", hint: "Todo el importe es exento." },
  { value: "U", label: "Tope en UMA", hint: "Queda exento hasta un número de UMA." },
  { value: "P", label: "Porcentaje del importe", hint: "Queda exento un porcentaje del importe." },
  { value: "M", label: "Porcentaje con tope en UMA", hint: "El porcentaje exento no puede pasar de un tope en UMA." },
];

const PERIODICITY_OPTIONS: { value: ExemptionPeriodicity; label: string }[] = [
  { value: "D", label: "Por día" },
  { value: "S", label: "Por semana" },
  { value: "M", label: "Por mes" },
  { value: "A", label: "Por año" },
  { value: "E", label: "Por evento" },
];

function parseDecimal(text: string, maxDecimals: number): number | null {
  const trimmed = text.trim().replace(/,/g, "");
  const pattern = new RegExp(`^\\d+(\\.\\d{1,${maxDecimals}})?$`);
  if (!pattern.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

interface ModalProps {
  perception: IPerception;
  onClose: () => void;
}

function PerceptionModal({ perception, onClose }: ModalProps) {
  const router = useRouter();
  const [limitType, setLimitType] = useState<ExemptionLimitType>(perception.tipo_limite_exencion);
  const [umasText, setUmasText] = useState(perception.umas_limite === null ? "" : String(perception.umas_limite));
  const [percentageText, setPercentageText] = useState(
    perception.porcentaje_exento === null ? "" : String(perception.porcentaje_exento),
  );
  const [periodicity, setPeriodicity] = useState<ExemptionPeriodicity | "">(perception.periodicidad_limite ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const needsUmas = limitType === "U" || limitType === "M";
  const needsPercentage = limitType === "P" || limitType === "M";
  const needsPeriodicity = limitType === "U" || limitType === "M";
  const selectedOption = LIMIT_TYPE_OPTIONS.find((option) => option.value === limitType);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const umas = needsUmas ? parseDecimal(umasText, 4) : null;
    const percentage = needsPercentage ? parseDecimal(percentageText, 2) : null;
    if (needsUmas && umas === null) {
      setErrorMessage("Captura el tope en UMA, mayor que cero y con hasta cuatro decimales.");
      return;
    }
    if (needsPercentage && (percentage === null || percentage > 100)) {
      setErrorMessage("Captura un porcentaje exento entre 0 y 100, con hasta dos decimales.");
      return;
    }
    if (needsPeriodicity && periodicity === "") {
      setErrorMessage("Elige la periodicidad del tope.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result = await savePerception({
        id_perception: perception.id_perception,
        tipo_limite_exencion: limitType,
        umas_limite: umas,
        porcentaje_exento: percentage,
        periodicidad_limite: needsPeriodicity ? periodicity : null,
      });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al guardar el tope de exención");
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
        aria-labelledby="perception-modal-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 shrink-0 rounded-lg bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center">
              <Scale size={18} />
            </span>
            <div className="min-w-0">
              <h3 id="perception-modal-title" className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
                Tope de exención
              </h3>
              <p className="text-xs text-[#44474f] dark:text-zinc-400 truncate">
                {perception.clave_sat} · {perception.description}
              </p>
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

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {errorMessage && (
            <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
            Tipo de tope
            <select
              value={limitType}
              onChange={(event) => setLimitType(event.target.value as ExemptionLimitType)}
              className={FIELD_CLASSES}
            >
              {LIMIT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="text-xs font-normal text-[#747780] dark:text-zinc-500">{selectedOption?.hint}</span>
          </label>

          {needsPercentage && (
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
              Porcentaje exento (%)
              <input
                type="text"
                inputMode="decimal"
                required
                value={percentageText}
                onChange={(event) => setPercentageText(event.target.value)}
                className={`${FIELD_CLASSES} tabular-nums`}
              />
            </label>
          )}

          {needsUmas && (
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
              Tope en UMA
              <input
                type="text"
                inputMode="decimal"
                required
                value={umasText}
                onChange={(event) => setUmasText(event.target.value)}
                className={`${FIELD_CLASSES} tabular-nums`}
              />
            </label>
          )}

          {needsPeriodicity && (
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
              Periodicidad del tope
              <select
                value={periodicity}
                required
                onChange={(event) => setPeriodicity(event.target.value as ExemptionPeriodicity | "")}
                className={FIELD_CLASSES}
              >
                <option value="">Elige una periodicidad</option>
                {PERIODICITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}

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

export function EditPerceptionButton({ perception }: { perception: IPerception }) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Editar tope de exención"
        aria-label={`Editar el tope de exención de ${perception.description}`}
        className="p-1.5 rounded-lg text-[#44474f] dark:text-zinc-400 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
      >
        <Pencil size={16} />
      </button>
      {isOpen && <PerceptionModal perception={perception} onClose={closeModal} />}
    </>
  );
}
