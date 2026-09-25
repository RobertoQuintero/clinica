"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { IScheduleDay, WeekdayNumber } from "@/interfaces/employee_schedule";
import { saveEmployeeSchedule } from "../actions";
import { WEEKDAY_LABELS } from "../scheduleFormatting";
import {
  DEFAULT_DAY_DRAFT,
  ScheduleDayDraft,
  buildDaysFromDrafts,
  buildDraftsFromDays,
  validateDayDraft,
} from "../scheduleValidation";

interface Props {
  id_empleado: number;
  currentDays: IScheduleDay[];
}

const WEEKDAYS: WeekdayNumber[] = [1, 2, 3, 4, 5, 6, 7];

const TIME_INPUT_CLASS =
  "rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm tabular-nums text-[#0b1c30] dark:text-zinc-100 focus:border-[#0051d5] focus:outline-none focus:ring-1 focus:ring-[#0051d5]";

const LINK_BUTTON_CLASS =
  "text-xs font-semibold text-[#0051d5] dark:text-blue-400 hover:underline disabled:opacity-40 disabled:no-underline";

/** Botón "Editar horario" + modal con los 7 días. Guardar reemplaza la semana completa. */
export default function EditScheduleModal({ id_empleado, currentDays }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [drafts, setDrafts] = useState(() => buildDraftsFromDays(currentDays));
  const [showErrors, setShowErrors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [serverErrorMessage, setServerErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  function openModal() {
    // Cada apertura parte del horario guardado, no de una edición cancelada.
    setDrafts(buildDraftsFromDays(currentDays));
    setShowErrors(false);
    setServerErrorMessage(null);
    setIsOpen(true);
  }

  function closeModal() {
    if (!isSaving) setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) setIsOpen(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, isSaving]);

  function updateDraft(weekday: WeekdayNumber, changes: Partial<ScheduleDayDraft>) {
    setDrafts((previous) => ({ ...previous, [weekday]: { ...previous[weekday], ...changes } }));
  }

  function toggleWorks(weekday: WeekdayNumber, works: boolean) {
    // Un día sin horas capturadas arranca con el horario típico al marcarlo.
    const isBlank = !drafts[weekday].entry1 && !drafts[weekday].exit1;
    updateDraft(weekday, works && isBlank ? { ...DEFAULT_DAY_DRAFT } : { works });
  }

  function copyToOtherWorkingDays(sourceWeekday: WeekdayNumber) {
    setDrafts((previous) => {
      const next = { ...previous };
      for (const weekday of WEEKDAYS) {
        if (weekday !== sourceWeekday && previous[weekday].works) {
          next[weekday] = { ...previous[sourceWeekday], works: true };
        }
      }
      return next;
    });
  }

  const dayErrors = Object.fromEntries(
    WEEKDAYS.map((weekday) => [weekday, validateDayDraft(drafts[weekday])])
  ) as Record<WeekdayNumber, string | null>;
  const hasErrors = WEEKDAYS.some((weekday) => dayErrors[weekday] !== null);
  const workingDaysCount = WEEKDAYS.filter((weekday) => drafts[weekday].works).length;

  async function handleSave() {
    setShowErrors(true);
    if (hasErrors) return;

    setIsSaving(true);
    setServerErrorMessage(null);
    try {
      const result = await saveEmployeeSchedule({
        id_empleado,
        days: buildDaysFromDrafts(drafts),
      });
      if (!result.ok) {
        setServerErrorMessage(result.message);
        return;
      }
      setIsOpen(false);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="px-4 py-2 bg-[#0051d5] text-white text-sm font-semibold rounded-lg hover:bg-[#0043b0] transition-colors"
      >
        Editar horario
      </button>

      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeModal();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-schedule-modal-title"
              className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
                <h3
                  id="edit-schedule-modal-title"
                  className="text-lg font-bold text-[#0b1c30] dark:text-zinc-50"
                >
                  Editar horario
                </h3>
                <button
                  onClick={closeModal}
                  aria-label="Cerrar"
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none"
                >
                  &times;
                </button>
              </div>

              <div className="flex flex-col gap-4 overflow-y-auto p-6">
                <p className="text-sm text-[#44474f] dark:text-zinc-400">
                  Marca los días que trabaja. Al guardar se reemplaza el horario completo de la semana.
                </p>

                {serverErrorMessage && (
                  <div
                    role="alert"
                    className="rounded-lg border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 px-4 py-3 text-sm text-[#ba1a1a] dark:text-red-400"
                  >
                    {serverErrorMessage}
                  </div>
                )}

                <ul className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50 border border-[#c4c6d0] dark:border-zinc-700 rounded-xl overflow-hidden">
                  {WEEKDAYS.map((weekday) => {
                    const draft = drafts[weekday];
                    const dayError = showErrors ? dayErrors[weekday] : null;
                    const dayName = WEEKDAY_LABELS[weekday].long;

                    return (
                      <li key={weekday} className="flex flex-col gap-2 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <label className="flex w-32 items-center gap-2 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
                            <input
                              type="checkbox"
                              checked={draft.works}
                              onChange={(event) => toggleWorks(weekday, event.target.checked)}
                              className="h-4 w-4 accent-[#0051d5]"
                            />
                            {dayName}
                          </label>

                          {draft.works ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="time"
                                aria-label={`${dayName}: entrada`}
                                value={draft.entry1}
                                onChange={(event) => updateDraft(weekday, { entry1: event.target.value })}
                                className={TIME_INPUT_CLASS}
                              />
                              <span aria-hidden="true" className="text-[#74777f]">–</span>
                              <input
                                type="time"
                                aria-label={`${dayName}: salida`}
                                value={draft.exit1}
                                onChange={(event) => updateDraft(weekday, { exit1: event.target.value })}
                                className={TIME_INPUT_CLASS}
                              />
                              {draft.hasSecondBlock && (
                                <>
                                  <span aria-hidden="true" className="px-1 text-xs text-[#74777f]">y</span>
                                  <input
                                    type="time"
                                    aria-label={`${dayName}: entrada del segundo bloque`}
                                    value={draft.entry2}
                                    onChange={(event) => updateDraft(weekday, { entry2: event.target.value })}
                                    className={TIME_INPUT_CLASS}
                                  />
                                  <span aria-hidden="true" className="text-[#74777f]">–</span>
                                  <input
                                    type="time"
                                    aria-label={`${dayName}: salida del segundo bloque`}
                                    value={draft.exit2}
                                    onChange={(event) => updateDraft(weekday, { exit2: event.target.value })}
                                    className={TIME_INPUT_CLASS}
                                  />
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-[#74777f] dark:text-zinc-500">Descanso</span>
                          )}
                        </div>

                        {draft.works && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 sm:pl-36">
                            {draft.hasSecondBlock ? (
                              <button
                                type="button"
                                onClick={() =>
                                  updateDraft(weekday, { hasSecondBlock: false, entry2: "", exit2: "" })
                                }
                                className={LINK_BUTTON_CLASS}
                              >
                                Quitar segundo bloque
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => updateDraft(weekday, { hasSecondBlock: true })}
                                className={LINK_BUTTON_CLASS}
                              >
                                Agregar segundo bloque
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => copyToOtherWorkingDays(weekday)}
                              disabled={workingDaysCount < 2}
                              className={LINK_BUTTON_CLASS}
                            >
                              Copiar a todos los días laborales
                            </button>
                          </div>
                        )}

                        {dayError && (
                          <p role="alert" className="sm:pl-36 text-xs text-[#ba1a1a] dark:text-red-400">
                            {dayError}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
                <button
                  onClick={closeModal}
                  disabled={isSaving}
                  className="rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-4 py-2 text-sm font-medium text-[#44474f] dark:text-zinc-300 hover:bg-[#f8f9fb] dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="rounded-lg bg-[#0051d5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0043b0] transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Guardando…" : "Guardar horario"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
