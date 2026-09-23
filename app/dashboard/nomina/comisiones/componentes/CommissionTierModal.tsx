"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Pencil, Percent, Plus, X } from "lucide-react";
import type { ICommissionTier } from "@/interfaces/payroll_commission";
import { formatTierRange, tierRangeOverlaps } from "@/lib/payroll/commissionTiers";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { createCommissionTier, updateCommissionTier } from "../actions";

type ModalProps = {
  /** Tramos vigentes de la empresa: solo para avisar traslapes antes de enviar; el servidor revalida. */
  tiers: ICommissionTier[];
  editedTier?: ICommissionTier;
  onClose: () => void;
};

const FIELD_CLASSES =
  "w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all disabled:bg-[#eff4ff] dark:disabled:bg-zinc-800/60 disabled:text-[#747780] disabled:cursor-not-allowed";

function parseWholeNumber(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  return Number(text);
}

function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Number(trimmed);
}

function CommissionTierModal({ tiers, editedTier, onClose }: ModalProps) {
  const router = useRouter();
  const isEditing = editedTier !== undefined;

  const [minText, setMinText] = useState(editedTier ? String(editedTier.min_consultas) : "");
  const [hasNoMaximum, setHasNoMaximum] = useState(editedTier ? editedTier.max_consultas === null : false);
  const [maxText, setMaxText] = useState(
    editedTier && editedTier.max_consultas !== null ? String(editedTier.max_consultas) : "",
  );
  const [amountText, setAmountText] = useState(editedTier ? String(editedTier.importe) : "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const minimum = parseWholeNumber(minText);
  const maximum = hasNoMaximum ? null : parseWholeNumber(maxText);
  const amount = parseAmount(amountText);
  const isRangeComplete =
    minimum !== null && minimum >= 1 && (hasNoMaximum || (maximum !== null && maximum >= minimum));

  const overlapsAnotherTier =
    isRangeComplete && tierRangeOverlaps(tiers, minimum, maximum, editedTier?.id_commission_tier ?? null);
  const secondOpenTier =
    isRangeComplete &&
    hasNoMaximum &&
    tiers.some((tier) => tier.max_consultas === null && tier.id_commission_tier !== editedTier?.id_commission_tier);
  const warningMessage = secondOpenTier
    ? "Ya existe un tramo sin máximo. Solo puede haber uno."
    : overlapsAnotherTier
      ? "Este rango se traslapa con otro tramo. Ajusta el mínimo o el máximo."
      : null;

  const previewLabel = isRangeComplete
    ? formatTierRange({ id_commission_tier: 0, min_consultas: minimum, max_consultas: maximum, importe: amount ?? 0 })
    : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (minimum === null || (!hasNoMaximum && maximum === null) || amount === null) {
      setErrorMessage('Completa el mínimo, el máximo (o marca "Sin máximo") y el importe con hasta dos decimales.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    const tierInput = { min_consultas: minimum, max_consultas: maximum, importe: amount };
    try {
      const result = editedTier
        ? await updateCommissionTier({ id_commission_tier: editedTier.id_commission_tier, tier: tierInput })
        : await createCommissionTier(tierInput);
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al guardar el tramo");
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
        aria-labelledby="commission-tier-modal-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center">
              <Percent size={18} />
            </span>
            <h3 id="commission-tier-modal-title" className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
              {isEditing ? "Editar tramo" : "Nuevo tramo"}
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

          <fieldset className="rounded-lg bg-[#eff4ff] dark:bg-zinc-800/60 p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
              Consultas atendidas en el periodo
            </legend>
            <div className="grid grid-cols-2 gap-4 mt-1">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#44474f] dark:text-zinc-300">
                Desde
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  autoFocus
                  value={minText}
                  onChange={(event) => setMinText(event.target.value)}
                  className={`${FIELD_CLASSES} tabular-nums`}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#44474f] dark:text-zinc-300">
                Hasta
                <input
                  type="text"
                  inputMode="numeric"
                  required={!hasNoMaximum}
                  disabled={hasNoMaximum}
                  value={hasNoMaximum ? "" : maxText}
                  placeholder={hasNoMaximum ? "Sin máximo" : ""}
                  onChange={(event) => setMaxText(event.target.value)}
                  className={`${FIELD_CLASSES} tabular-nums`}
                />
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs font-medium text-[#44474f] dark:text-zinc-300">
              <input
                type="checkbox"
                checked={hasNoMaximum}
                onChange={(event) => setHasNoMaximum(event.target.checked)}
                className="h-4 w-4 accent-[#0051d5]"
              />
              Sin máximo (aplica desde el mínimo en adelante)
            </label>
          </fieldset>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
            Comisión fija (MXN)
            <input
              type="text"
              inputMode="decimal"
              required
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
              className={`${FIELD_CLASSES} tabular-nums`}
            />
            <span className="text-xs font-normal text-[#747780] dark:text-zinc-500">
              Se paga completa al alcanzar el tramo; no se multiplica por consulta.
            </span>
          </label>

          {warningMessage && (
            <p role="alert" className="rounded-md bg-amber-50 dark:bg-amber-900/30 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
              {warningMessage}
            </p>
          )}

          <div
            aria-live="polite"
            className="flex items-center gap-3 rounded-lg border border-dashed border-[#c4c6d0] dark:border-zinc-600 px-4 py-3 text-sm min-h-[3rem]"
          >
            {previewLabel ? (
              <>
                <span className="font-semibold text-[#0b1c30] dark:text-zinc-100">{previewLabel}</span>
                <ArrowRight size={16} className="text-[#747780]" />
                <span className="font-semibold tabular-nums text-[#0051d5] dark:text-blue-300">
                  {formatPayrollCurrency(amount ?? 0)}
                </span>
              </>
            ) : (
              <span className="text-[#747780] dark:text-zinc-500">Así se leerá el tramo cuando completes el rango.</span>
            )}
          </div>

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
              {isSaving ? "Guardando…" : isEditing ? "Guardar cambios" : "Crear tramo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function NewCommissionTierButton({ tiers }: { tiers: ICommissionTier[] }) {
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
        Nuevo tramo
      </button>
      {isOpen && <CommissionTierModal tiers={tiers} onClose={closeModal} />}
    </>
  );
}

export function EditCommissionTierButton({ tier, tiers }: { tier: ICommissionTier; tiers: ICommissionTier[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Editar tramo"
        aria-label={`Editar tramo de ${formatTierRange(tier)}`}
        className="p-1.5 rounded-lg text-[#44474f] dark:text-zinc-400 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
      >
        <Pencil size={16} />
      </button>
      {isOpen && <CommissionTierModal tiers={tiers} editedTier={tier} onClose={closeModal} />}
    </>
  );
}
