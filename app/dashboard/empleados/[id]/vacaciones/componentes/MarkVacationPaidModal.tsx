"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import JustificationModalFrame, {
  JUSTIFICATION_FIELD_CLASSES,
  JUSTIFICATION_MAX_COMMENT_LENGTH,
} from "@/app/dashboard/nomina/componentes/JustificationModalFrame";
import type { IJustificationSummaryItem } from "@/app/dashboard/nomina/componentes/justificationTypes";
import { markVacationDaysPaid } from "../actions";

interface Props {
  id_empleado: number;
  id_vacation_entitlement: number;
  employeeName: string;
  /** Días que se marcarán como pagados (derecho − tomados); solo informativo, lo calcula el servidor. */
  daysToPay: number;
  /** Fecha de pago por defecto: hoy en Ciudad de México, calculada en el servidor. */
  defaultPaymentDate: string;
  summaryItems: IJustificationSummaryItem[];
}

interface ModalProps extends Props {
  onClose: () => void;
}

function MarkVacationPaidForm({
  id_empleado,
  id_vacation_entitlement,
  employeeName,
  daysToPay,
  defaultPaymentDate,
  summaryItems,
  onClose,
}: ModalProps) {
  const router = useRouter();
  const [paymentDate, setPaymentDate] = useState(defaultPaymentDate);
  const [commentText, setCommentText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function savePayment() {
    if (!paymentDate) {
      setErrorMessage("Captura la fecha de pago");
      return;
    }
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const result = await markVacationDaysPaid({
        id_empleado,
        id_vacation_entitlement,
        fecha_pago: paymentDate,
        comentario: commentText.trim() || undefined,
      });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al guardar");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <JustificationModalFrame
      titleId="mark-vacation-paid-modal-title"
      title="Marcar como pagadas"
      icon={<Banknote size={18} />}
      employeeName={employeeName}
      summaryItems={summaryItems}
      isBusy={isSaving}
      onClose={onClose}
    >
      <p className="text-sm text-[#44474f] dark:text-zinc-400">
        Se registra el pago de {daysToPay} {daysToPay === 1 ? "día" : "días"} de vacaciones no
        disfrutadas. Esto solo deja constancia: el importe no se calcula en nómina.
      </p>

      {errorMessage && (
        <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
        Fecha de pago
        <input
          type="date"
          required
          value={paymentDate}
          onChange={(event) => setPaymentDate(event.target.value)}
          disabled={isSaving}
          className={JUSTIFICATION_FIELD_CLASSES}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
        Comentario (opcional)
        <textarea
          rows={3}
          maxLength={JUSTIFICATION_MAX_COMMENT_LENGTH}
          value={commentText}
          onChange={(event) => setCommentText(event.target.value)}
          disabled={isSaving}
          className={`${JUSTIFICATION_FIELD_CLASSES} resize-none`}
        />
      </label>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-5 py-2.5 text-sm font-semibold text-[#44474f] dark:text-zinc-300 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={savePayment}
          disabled={isSaving}
          className="rounded-lg bg-[#0051d5] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? "Guardando…" : "Marcar como pagadas"}
        </button>
      </div>
    </JustificationModalFrame>
  );
}

/** Botón del año `por_pagar`: abre el modal que registra la fecha y el comentario del pago. */
export default function MarkVacationPaidModal(props: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90"
      >
        <Banknote size={16} aria-hidden />
        Marcar como pagadas
      </button>
      {isOpen && <MarkVacationPaidForm {...props} onClose={closeModal} />}
    </>
  );
}
