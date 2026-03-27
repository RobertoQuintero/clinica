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
    <div className="mb-6 flex items-center gap-4">
      <button
        onClick={onBack}
        className="rounded-md border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
      >
        ← Volver
      </button>
      <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-50 flex-1">
        Expediente — {nombre}
      </h2>
      <button
        onClick={onGoToExpedienteMedico}
        className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >
        Expediente médico
      </button>
      <button
        onClick={onOpenNew}
        className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
      >
        + Nueva consulta
      </button>
    </div>
  );
}
