"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Scale, X } from "lucide-react";
import type { ITaxParameter, TaxParameterKey } from "@/interfaces/payroll_tax_parameters";
import { TAX_PARAMETER_KEYS } from "@/lib/payroll/constants";
import { saveTaxParameter } from "../actions";

type ModalProps = {
  /** Ejercicio del selector: sugiere el 1 de enero de ese año como vigencia en un alta. */
  year: number;
  editedParameter?: ITaxParameter;
  onClose: () => void;
};

const FIELD_CLASSES =
  "w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all disabled:bg-[#eff4ff] dark:disabled:bg-zinc-800/60 disabled:text-[#747780] disabled:cursor-not-allowed";

const PARAMETER_KEY_OPTIONS = Object.entries(TAX_PARAMETER_KEYS) as [
  TaxParameterKey,
  (typeof TAX_PARAMETER_KEYS)[TaxParameterKey],
][];

function parseValue(text: string): number | null {
  const trimmed = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,4})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

function TaxParameterModal({ year, editedParameter, onClose }: ModalProps) {
  const router = useRouter();
  const isEditing = editedParameter !== undefined;

  const [parameterKey, setParameterKey] = useState<TaxParameterKey>(editedParameter?.clave ?? "UMA_DIARIA");
  const [effectiveDate, setEffectiveDate] = useState(
    editedParameter ? editedParameter.vigente_desde.slice(0, 10) : `${year}-01-01`,
  );
  const [valueText, setValueText] = useState(editedParameter ? String(editedParameter.valor) : "");
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
    const value = parseValue(valueText);
    if (value === null) {
      setErrorMessage("Captura un valor mayor que cero con hasta cuatro decimales.");
      return;
    }
    if (!effectiveDate) {
      setErrorMessage("Indica desde qué fecha es vigente el parámetro.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result = await saveTaxParameter({ clave: parameterKey, vigente_desde: effectiveDate, valor: value });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al guardar el parámetro");
    } finally {
      setIsSaving(false);
    }
  }

  const unit = TAX_PARAMETER_KEYS[parameterKey].unit;

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
        aria-labelledby="tax-parameter-modal-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center">
              <Scale size={18} />
            </span>
            <h3 id="tax-parameter-modal-title" className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
              {isEditing ? "Editar parámetro" : "Nuevo parámetro"}
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
            Parámetro
            <select
              value={parameterKey}
              disabled={isEditing}
              onChange={(event) => setParameterKey(event.target.value as TaxParameterKey)}
              className={FIELD_CLASSES}
            >
              {PARAMETER_KEY_OPTIONS.map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
            Vigente desde
            <input
              type="date"
              required
              value={effectiveDate}
              disabled={isEditing}
              onChange={(event) => setEffectiveDate(event.target.value)}
              className={`${FIELD_CLASSES} tabular-nums`}
            />
            <span className="text-xs font-normal text-[#747780] dark:text-zinc-500">
              Aplica a los periodos cuya fecha de fin sea igual o posterior a esta fecha.
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
            Valor ({unit})
            <input
              type="text"
              inputMode="decimal"
              required
              autoFocus
              value={valueText}
              onChange={(event) => setValueText(event.target.value)}
              className={`${FIELD_CLASSES} tabular-nums`}
            />
          </label>

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
              {isSaving ? "Guardando…" : isEditing ? "Guardar cambios" : "Crear parámetro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function NewTaxParameterButton({ year }: { year: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-[#0051d5] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90"
      >
        <Plus size={18} />
        Nuevo parámetro
      </button>
      {isOpen && <TaxParameterModal year={year} onClose={closeModal} />}
    </>
  );
}

export function EditTaxParameterButton({ parameter, year }: { parameter: ITaxParameter; year: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Editar parámetro"
        aria-label={`Editar ${TAX_PARAMETER_KEYS[parameter.clave].label}`}
        className="p-1.5 rounded-lg text-[#44474f] dark:text-zinc-400 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
      >
        <Pencil size={16} />
      </button>
      {isOpen && <TaxParameterModal year={year} editedParameter={parameter} onClose={closeModal} />}
    </>
  );
}
