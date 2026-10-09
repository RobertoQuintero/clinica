"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Scale, X } from "lucide-react";
import type { IWithholdingBracket } from "@/interfaces/payroll_tax_parameters";
import { withholdingBracketOverlaps } from "@/lib/payroll/taxParameters";
import { formatPayrollCurrency } from "@/lib/payroll/moneyFormat";
import { saveWithholdingBracket } from "../actions";

type ModalProps = {
  year: number;
  /** Tramos del ejercicio: solo para avisar traslapes antes de enviar; el servidor revalida. */
  brackets: IWithholdingBracket[];
  editedBracket?: IWithholdingBracket;
  onClose: () => void;
};

const FIELD_CLASSES =
  "w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all disabled:bg-[#eff4ff] dark:disabled:bg-zinc-800/60 disabled:text-[#747780] disabled:cursor-not-allowed";

function parseTwoDecimalNumber(text: string): number | null {
  const trimmed = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Number(trimmed);
}

function WithholdingBracketModal({ year, brackets, editedBracket, onClose }: ModalProps) {
  const router = useRouter();
  const isEditing = editedBracket !== undefined;

  const [lowerLimitText, setLowerLimitText] = useState(editedBracket ? String(editedBracket.limite_inferior) : "");
  const [hasNoUpperLimit, setHasNoUpperLimit] = useState(editedBracket ? editedBracket.limite_superior === null : false);
  const [upperLimitText, setUpperLimitText] = useState(
    editedBracket && editedBracket.limite_superior !== null ? String(editedBracket.limite_superior) : "",
  );
  const [fixedFeeText, setFixedFeeText] = useState(editedBracket ? String(editedBracket.cuota_fija) : "");
  const [percentageText, setPercentageText] = useState(editedBracket ? String(editedBracket.porcentaje_excedente) : "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const lowerLimit = parseTwoDecimalNumber(lowerLimitText);
  const upperLimit = hasNoUpperLimit ? null : parseTwoDecimalNumber(upperLimitText);
  const fixedFee = parseTwoDecimalNumber(fixedFeeText);
  const percentage = parseTwoDecimalNumber(percentageText);
  const editedBracketId = editedBracket?.id_tarifa ?? null;

  const isRangeComplete =
    lowerLimit !== null && (hasNoUpperLimit || (upperLimit !== null && upperLimit > lowerLimit));
  const secondOpenBracket =
    isRangeComplete &&
    hasNoUpperLimit &&
    brackets.some((bracket) => bracket.limite_superior === null && bracket.id_tarifa !== editedBracketId);
  const overlapsAnotherBracket =
    isRangeComplete && withholdingBracketOverlaps(brackets, lowerLimit, upperLimit, editedBracketId);
  const warningMessage = secondOpenBracket
    ? "Ya existe un tramo sin límite superior. Solo puede haber uno."
    : overlapsAnotherBracket
      ? "Este rango se traslapa con otro tramo. Ajusta el límite inferior o el superior."
      : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (lowerLimit === null || (!hasNoUpperLimit && upperLimit === null) || fixedFee === null || percentage === null) {
      setErrorMessage(
        'Completa los límites (o marca "Sin límite superior"), la cuota fija y el porcentaje con hasta dos decimales.',
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    const bracketFields = {
      limite_inferior: lowerLimit,
      limite_superior: upperLimit,
      cuota_fija: fixedFee,
      porcentaje_excedente: percentage,
    };
    try {
      const result = await saveWithholdingBracket(
        editedBracket
          ? { id_tarifa: editedBracket.id_tarifa, ...bracketFields }
          : { ejercicio: year, ...bracketFields },
      );
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
        aria-labelledby="withholding-bracket-modal-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center">
              <Scale size={18} />
            </span>
            <h3 id="withholding-bracket-modal-title" className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
              {isEditing ? "Editar tramo" : `Nuevo tramo ${year}`}
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
              Ingreso semanal gravable (MXN)
            </legend>
            <div className="grid grid-cols-2 gap-4 mt-1">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#44474f] dark:text-zinc-300">
                Límite inferior
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  autoFocus
                  value={lowerLimitText}
                  onChange={(event) => setLowerLimitText(event.target.value)}
                  className={`${FIELD_CLASSES} tabular-nums`}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#44474f] dark:text-zinc-300">
                Límite superior
                <input
                  type="text"
                  inputMode="decimal"
                  required={!hasNoUpperLimit}
                  disabled={hasNoUpperLimit}
                  value={hasNoUpperLimit ? "" : upperLimitText}
                  placeholder={hasNoUpperLimit ? "En adelante" : ""}
                  onChange={(event) => setUpperLimitText(event.target.value)}
                  className={`${FIELD_CLASSES} tabular-nums`}
                />
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs font-medium text-[#44474f] dark:text-zinc-300">
              <input
                type="checkbox"
                checked={hasNoUpperLimit}
                onChange={(event) => setHasNoUpperLimit(event.target.checked)}
                className="h-4 w-4 accent-[#0051d5]"
              />
              Sin límite superior (aplica desde el inferior en adelante)
            </label>
          </fieldset>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
              Cuota fija (MXN)
              <input
                type="text"
                inputMode="decimal"
                required
                value={fixedFeeText}
                onChange={(event) => setFixedFeeText(event.target.value)}
                className={`${FIELD_CLASSES} tabular-nums`}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
              % sobre el excedente
              <input
                type="text"
                inputMode="decimal"
                required
                value={percentageText}
                onChange={(event) => setPercentageText(event.target.value)}
                className={`${FIELD_CLASSES} tabular-nums`}
              />
            </label>
          </div>

          {warningMessage && (
            <p role="alert" className="rounded-md bg-amber-50 dark:bg-amber-900/30 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
              {warningMessage}
            </p>
          )}

          <p aria-live="polite" className="rounded-lg border border-dashed border-[#c4c6d0] dark:border-zinc-600 px-4 py-3 text-sm min-h-[3rem] text-[#44474f] dark:text-zinc-400">
            {isRangeComplete ? (
              <>
                De{" "}
                <span className="font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100">
                  {formatPayrollCurrency(lowerLimit)}
                </span>{" "}
                {upperLimit === null ? (
                  "en adelante"
                ) : (
                  <>
                    a{" "}
                    <span className="font-semibold tabular-nums text-[#0b1c30] dark:text-zinc-100">
                      {formatPayrollCurrency(upperLimit)}
                    </span>
                  </>
                )}
              </>
            ) : (
              "Así se leerá el tramo cuando completes el rango."
            )}
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
              {isSaving ? "Guardando…" : isEditing ? "Guardar cambios" : "Crear tramo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function NewWithholdingBracketButton({ year, brackets }: { year: number; brackets: IWithholdingBracket[] }) {
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
      {isOpen && <WithholdingBracketModal year={year} brackets={brackets} onClose={closeModal} />}
    </>
  );
}

export function EditWithholdingBracketButton({
  bracket,
  brackets,
  year,
}: {
  bracket: IWithholdingBracket;
  brackets: IWithholdingBracket[];
  year: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Editar tramo"
        aria-label={`Editar el tramo que empieza en ${formatPayrollCurrency(bracket.limite_inferior)}`}
        className="p-1.5 rounded-lg text-[#44474f] dark:text-zinc-400 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
      >
        <Pencil size={16} />
      </button>
      {isOpen && (
        <WithholdingBracketModal year={year} brackets={brackets} editedBracket={bracket} onClose={closeModal} />
      )}
    </>
  );
}
