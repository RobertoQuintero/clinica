"use client";

import { IPaciente } from "@/interfaces/paciente";

interface Props {
  paciente:              IPaciente | null;
  id_paciente:           number;
  onBack:                () => void;
  onGoToExpedienteMedico: () => void;
  onOpenNew:             () => void;
}

export default function ExpedienteHeader({
  paciente,
  id_paciente,
  onBack,
  onGoToExpedienteMedico,
  onOpenNew,
}: Props) {
  const nombre = paciente
    ? `${paciente.nombre} ${paciente.apellido_paterno} ${paciente.apellido_materno}`.trim()
    : `Paciente #${id_paciente}`;

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      {/* Fila superior: botón volver + título */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          onClick={onBack}
          className="shrink-0 rounded-md border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          ← Volver
        </button>
        <h2 className="min-w-0 truncate text-xl font-semibold text-zinc-800 dark:text-zinc-50 sm:text-2xl">
          Expediente — {nombre}
        </h2>
      </div>

      {/* Fila inferior (móvil) / derecha (desktop): botones de acción */}
      <div className="flex shrink-0 gap-2">
        <button
          onClick={onGoToExpedienteMedico}
          className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 sm:flex-none sm:px-4 sm:text-sm"
        >
          Expediente médico
        </button>
        <button
          onClick={onOpenNew}
          className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 sm:flex-none sm:px-4 sm:text-sm"
        >
          + Nueva consulta
        </button>
      </div>
    </div>
  );
}
