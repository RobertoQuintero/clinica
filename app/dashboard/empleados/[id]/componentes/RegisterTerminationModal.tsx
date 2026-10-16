"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlert, UserMinus } from "lucide-react";
import JustificationModalFrame, {
  JUSTIFICATION_FIELD_CLASSES,
} from "@/app/dashboard/nomina/componentes/JustificationModalFrame";
import { useAsyncData } from "@/hooks/useAsyncData";
import type { ITerminationCause, TerminationType } from "@/interfaces/employee_termination";
import {
  TERMINATION_NOTES_MAX_LENGTH,
  TERMINATION_TYPE_LABELS,
} from "@/lib/terminations/terminationRules";
import { addZeroToday } from "@/utils/date_helpper";
import { getTerminationWarnings, registerEmployeeTermination } from "../bajas/actions";

interface Props {
  id_empleado: number;
  employeeName: string;
  /** "YYYY-MM-DD": la baja no puede ser anterior. */
  hireDate: string;
  /** `false` cuando el empleado ya estaba inactivo sin baja: la fecha puede ser pasada y `activo` no cambia. */
  isActive: boolean;
  causes: ITerminationCause[];
  onClose: () => void;
}

const TERMINATION_TYPES: TerminationType[] = ["R", "D"];

/** Modal "Dar de baja" (spec 86): fecha, causa IMSS, tipo renuncia/despido y observaciones. */
export default function RegisterTerminationModal({
  id_empleado,
  employeeName,
  hireDate,
  isActive,
  causes,
  onClose,
}: Props) {
  const router = useRouter();
  const today = addZeroToday(new Date());
  const [terminationDate, setTerminationDate] = useState(today);
  const [selectedCauseKey, setSelectedCauseKey] = useState("");
  // `null` = el usuario no ha tocado el tipo: se usa el sugerido por la causa.
  const [typeOverride, setTypeOverride] = useState<TerminationType | null>(null);
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: warnings } = useAsyncData(["termination-warnings", id_empleado], () =>
    getTerminationWarnings(id_empleado)
  );

  const selectedCause = causes.find((cause) => cause.clave === selectedCauseKey) ?? null;
  const terminationType = typeOverride ?? selectedCause?.tipo_terminacion_sugerido ?? null;
  const hasWarnings = warnings !== undefined && (warnings.linkedUsers > 0 || warnings.activeIdentifiers > 0);
  const canSave =
    terminationDate !== "" &&
    terminationDate >= hireDate &&
    terminationDate <= today &&
    selectedCause !== null &&
    terminationType !== null;

  function selectCause(causeKey: string) {
    setSelectedCauseKey(causeKey);
    // Al cambiar de causa se vuelve a sugerir el tipo de la nueva causa.
    setTypeOverride(null);
  }

  async function saveTermination() {
    if (!canSave) return;
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const result = await registerEmployeeTermination({
        id_empleado,
        fecha_baja: terminationDate,
        clave_causa: selectedCauseKey,
        tipo_terminacion: terminationType,
        observaciones: notes,
      });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al registrar la baja");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <JustificationModalFrame
      titleId="register-termination-modal-title"
      title={isActive ? "Dar de baja" : "Registrar baja"}
      icon={<UserMinus size={18} />}
      employeeName={employeeName}
      summaryItems={[
        { label: "Ingreso", value: hireDate.split("-").reverse().join("/") },
        { label: "Estado actual", value: isActive ? "Activo" : "Inactivo sin baja registrada" },
      ]}
      isBusy={isSaving}
      onClose={onClose}
    >
      {errorMessage && (
        <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
        Último día laborado
        <input
          type="date"
          autoFocus
          min={hireDate}
          max={today}
          value={terminationDate}
          onChange={(event) => setTerminationDate(event.target.value)}
          disabled={isSaving}
          className={JUSTIFICATION_FIELD_CLASSES}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
        Causa de baja
        <select
          value={selectedCauseKey}
          onChange={(event) => selectCause(event.target.value)}
          disabled={isSaving}
          className={JUSTIFICATION_FIELD_CLASSES}
        >
          <option value="">Selecciona una causa</option>
          {causes.map((cause) => (
            <option key={cause.clave} value={cause.clave}>
              {cause.clave} · {cause.nombre}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-1.5" disabled={isSaving || selectedCause === null}>
        <legend className="text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">Tipo de baja</legend>
        <div className="flex flex-wrap gap-3">
          {TERMINATION_TYPES.map((type) => (
            <label
              key={type}
              className="flex items-center gap-2 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 px-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 has-[:checked]:border-[#0051d5] has-[:checked]:bg-[#0051d5]/5"
            >
              <input
                type="radio"
                name="termination-type"
                value={type}
                checked={terminationType === type}
                onChange={() => setTypeOverride(type)}
              />
              {TERMINATION_TYPE_LABELS[type]}
            </label>
          ))}
        </div>
        {selectedCause && (
          <p className="text-xs text-[#44474f] dark:text-zinc-400">
            Sugerido por la causa: {TERMINATION_TYPE_LABELS[selectedCause.tipo_terminacion_sugerido]}. Puedes cambiarlo.
          </p>
        )}
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
        Observaciones (opcional)
        <textarea
          rows={3}
          maxLength={TERMINATION_NOTES_MAX_LENGTH}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={isSaving}
          className={`${JUSTIFICATION_FIELD_CLASSES} resize-none`}
        />
      </label>

      {hasWarnings && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 px-4 py-2 text-sm text-amber-800 dark:text-amber-300"
        >
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Tiene {warnings.linkedUsers} usuarios vinculados y {warnings.activeIdentifiers} identificadores de
            checador activos. La baja no los desactiva: revisa las pestañas{" "}
            <Link href={`/dashboard/empleados/${id_empleado}/usuarios`} className="font-semibold underline">
              Usuarios
            </Link>{" "}
            y{" "}
            <Link href={`/dashboard/empleados/${id_empleado}/asistencia`} className="font-semibold underline">
              Asistencia
            </Link>
            .
          </span>
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
          onClick={saveTermination}
          disabled={isSaving || !canSave}
          className="rounded-lg bg-[#ba1a1a] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#ba1a1a]/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? "Guardando…" : isActive ? "Dar de baja" : "Registrar baja"}
        </button>
      </div>
    </JustificationModalFrame>
  );
}
