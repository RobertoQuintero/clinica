"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CircleAlert } from "lucide-react";
import { useIsClient } from "@/hooks/useIsClient";
import type { IPayrollCfdiReceipt, PayrollCfdiCancellationMotive } from "@/interfaces/payroll_cfdi";
import {
  formatPayrollReceiptFolio,
  PAYROLL_CFDI_CANCELLATION_MOTIVE_OPTIONS,
} from "@/lib/payroll/cfdi/payrollCfdiCancellation";
import { cancelPayrollReceipt } from "../actions";

interface Props {
  receipt: IPayrollCfdiReceipt;
  employeeName: string;
  issuerName: string | null;
  onClose: () => void;
  onCancelled: () => void;
}

/**
 * Diálogo de confirmación para cancelar un CFDI de nómina (spec 99), reutilizable en la celda
 * "CFDI" de Procesar y en `PayrollCfdiCard` del Detalle. En Live exige escribir el folio exacto.
 */
export default function PayrollCfdiCancelDialog({ receipt, employeeName, issuerName, onClose, onCancelled }: Props) {
  const isClient = useIsClient();
  const [motive, setMotive] = useState<PayrollCfdiCancellationMotive | "">("");
  const [confirmFolio, setConfirmFolio] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isClient) return null;

  const expectedFolio = formatPayrollReceiptFolio(receipt);
  const folioMatches = !receipt.livemode || confirmFolio === expectedFolio;
  const canConfirm = motive !== "" && folioMatches && !isRunning;

  async function handleConfirm() {
    if (motive === "") return;
    setIsRunning(true);
    setErrorMessage(null);
    try {
      const result = await cancelPayrollReceipt({
        idReceipt: receipt.id_period_employee_cfdi,
        motive,
        confirmFolio: receipt.livemode ? confirmFolio : undefined,
      });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      onCancelled();
    } catch {
      setErrorMessage("Error inesperado al cancelar el CFDI");
    } finally {
      setIsRunning(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 shadow-xl">
        <div className="px-6 py-5 flex flex-col gap-4">
          <h2 className="text-base font-semibold text-[#0b1c30] dark:text-zinc-50">Cancelar CFDI de nómina</h2>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-[#44474f] dark:text-zinc-400">Empleado</dt>
            <dd className="text-[#0b1c30] dark:text-zinc-100">{employeeName}</dd>
            <dt className="text-[#44474f] dark:text-zinc-400">UUID</dt>
            <dd className="font-mono text-xs text-[#0b1c30] dark:text-zinc-100 break-all">{receipt.uuid}</dd>
            <dt className="text-[#44474f] dark:text-zinc-400">Folio</dt>
            <dd className="tabular-nums text-[#0b1c30] dark:text-zinc-100">{expectedFolio}</dd>
            <dt className="text-[#44474f] dark:text-zinc-400">Emisor</dt>
            <dd className="text-[#0b1c30] dark:text-zinc-100">
              {issuerName ?? "—"} ({receipt.livemode ? "Live" : "Test"})
            </dd>
          </dl>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">Motivo de cancelación</legend>
            {PAYROLL_CFDI_CANCELLATION_MOTIVE_OPTIONS.map((option) => (
              <label key={option.code} className="flex items-center gap-2 text-sm text-[#44474f] dark:text-zinc-300">
                <input
                  type="radio"
                  name="motive"
                  value={option.code}
                  checked={motive === option.code}
                  onChange={() => setMotive(option.code as PayrollCfdiCancellationMotive)}
                  className="accent-[#0051d5]"
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          {receipt.livemode && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-folio" className="text-sm font-medium text-[#0b1c30] dark:text-zinc-100">
                Escribe <span className="font-mono">{expectedFolio}</span> para confirmar
              </label>
              <input
                id="confirm-folio"
                type="text"
                value={confirmFolio}
                onChange={(e) => setConfirmFolio(e.target.value)}
                placeholder={expectedFolio}
                className="rounded-md border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-[#0b1c30] dark:text-zinc-100 font-mono"
              />
              <p className="flex gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                <CircleAlert size={13} className="shrink-0 mt-0.5" aria-hidden />
                Esta acción se reporta al SAT y no se puede deshacer.
              </p>
            </div>
          )}

          {errorMessage && (
            <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-200 dark:border-zinc-700 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="rounded-lg bg-[#ba1a1a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ba1a1a]/90 transition-colors disabled:opacity-50"
          >
            {isRunning ? "Cancelando…" : "Cancelar CFDI"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
