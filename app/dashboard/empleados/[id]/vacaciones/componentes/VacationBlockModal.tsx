"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import JustificationModalFrame, {
  JUSTIFICATION_FIELD_CLASSES,
} from "@/app/dashboard/nomina/componentes/JustificationModalFrame";
import { calculateVacationEndDate, getNextWorkingDate } from "@/lib/vacations/vacationDates";
import { formatIsoDateForDisplay } from "@/lib/vacations/vacationFormatting";
import { scheduleVacationBlock } from "../actions";

interface Props {
  id_empleado: number;
  id_vacation_entitlement: number;
  employeeName: string;
  servicioYear: number;
  entitledDays: number;
  anniversaryDate: string;
  requestDeadline: string;
  nextAnniversaryDate: string;
  workingWeekdays: number[];
}

interface ModalProps extends Props {
  onClose: () => void;
}

function VacationBlockForm({
  id_empleado,
  id_vacation_entitlement,
  employeeName,
  servicioYear,
  entitledDays,
  anniversaryDate,
  requestDeadline,
  nextAnniversaryDate,
  workingWeekdays,
  onClose,
}: ModalProps) {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [daysTaken, setDaysTaken] = useState(String(entitledDays));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const parsedDaysTaken = Number(daysTaken);
  const isDaysTakenValid =
    Number.isInteger(parsedDaysTaken) && parsedDaysTaken >= 1 && parsedDaysTaken <= entitledDays;

  const { endDate, returnDate } = useMemo(() => {
    if (!startDate || !isDaysTakenValid) return { endDate: null, returnDate: null };
    const calculatedEndDate = calculateVacationEndDate(startDate, parsedDaysTaken, workingWeekdays);
    return {
      endDate: calculatedEndDate,
      returnDate: calculatedEndDate ? getNextWorkingDate(calculatedEndDate, workingWeekdays) : null,
    };
  }, [startDate, parsedDaysTaken, isDaysTakenValid, workingWeekdays]);

  const exceedsServiceYear = endDate !== null && endDate >= nextAnniversaryDate;
  const startsBeforeAnniversary = startDate !== "" && startDate < anniversaryDate;
  const canSave =
    startDate !== "" && isDaysTakenValid && endDate !== null && !exceedsServiceYear && !startsBeforeAnniversary;

  async function saveBlock() {
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const result = await scheduleVacationBlock({
        id_empleado,
        id_vacation_entitlement,
        fecha_inicio: startDate,
        dias_tomados: parsedDaysTaken,
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
      titleId="vacation-block-modal-title"
      title="Capturar vacaciones"
      icon={<CalendarPlus size={18} />}
      employeeName={employeeName}
      summaryItems={[
        { label: "Año de servicio", value: String(servicioYear) },
        { label: "Días de derecho", value: String(entitledDays) },
        { label: "Solicitar a más tardar", value: formatIsoDateForDisplay(requestDeadline) },
        { label: "Vence el año el", value: formatIsoDateForDisplay(nextAnniversaryDate) },
      ]}
      isBusy={isSaving}
      onClose={onClose}
    >
      <p className="text-sm text-[#44474f] dark:text-zinc-400">
        Un solo bloque continuo. Solo cuentan los días laborables del horario; los días de descanso
        se saltan. Los días que no se tomen quedan por pagar.
      </p>

      {errorMessage && (
        <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
          Primer día de vacaciones
          <input
            type="date"
            required
            min={anniversaryDate}
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            disabled={isSaving}
            className={JUSTIFICATION_FIELD_CLASSES}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
          Días a tomar
          <input
            type="number"
            required
            min={1}
            max={entitledDays}
            step={1}
            value={daysTaken}
            onChange={(event) => setDaysTaken(event.target.value)}
            disabled={isSaving}
            className={JUSTIFICATION_FIELD_CLASSES}
          />
        </label>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-dashed border-[#c4c6d0] dark:border-zinc-700 px-4 py-3">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            Último día de vacaciones
          </dt>
          <dd className="text-sm font-medium tabular-nums text-[#0b1c30] dark:text-zinc-100">
            {endDate ? formatIsoDateForDisplay(endDate) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#44474f] dark:text-zinc-400">
            Regresa a trabajar
          </dt>
          <dd className="text-sm font-medium tabular-nums text-[#0b1c30] dark:text-zinc-100">
            {returnDate ? formatIsoDateForDisplay(returnDate) : "—"}
          </dd>
        </div>
      </dl>

      {exceedsServiceYear && (
        <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">
          El bloque terminaría el {formatIsoDateForDisplay(endDate)}, en o después del siguiente
          aniversario. Las vacaciones no son acumulativas: reduce los días o adelanta el inicio.
        </p>
      )}
      {startsBeforeAnniversary && (
        <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">
          El bloque no puede empezar antes del aniversario ({formatIsoDateForDisplay(anniversaryDate)}).
        </p>
      )}

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
          onClick={saveBlock}
          disabled={isSaving || !canSave}
          className="rounded-lg bg-[#0051d5] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? "Guardando…" : "Capturar vacaciones"}
        </button>
      </div>
    </JustificationModalFrame>
  );
}

/** Botón "Capturar vacaciones" del año vigente; abre el modal de captura del bloque único. */
export default function VacationBlockModal(props: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);
  const hasNoSchedule = props.workingWeekdays.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={hasNoSchedule}
        title={hasNoSchedule ? "Sin horario definido" : undefined}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0051d5]/90 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <CalendarPlus size={16} aria-hidden />
        Capturar vacaciones
      </button>
      {isOpen && <VacationBlockForm {...props} onClose={closeModal} />}
    </>
  );
}
