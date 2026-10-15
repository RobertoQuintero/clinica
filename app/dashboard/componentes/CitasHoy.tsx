"use client";

import { useState } from "react";
import PacientesFaltantes from "./PacientesFaltantes";
import PacientesCumpleanos from "./PacientesCumpleanos";
import ConsultasRango from "./ConsultasRango";

type Tab = "faltantes" | "cumpleanos" | "consultas";

const TABS: { key: Tab; label: string }[] = [
  { key: "faltantes",  label: "Faltantes" },
  { key: "cumpleanos", label: "Cumpleaños" },
  { key: "consultas",  label: "Consultas" },
];

export default function CitasHoy() {
  const [tab, setTab] = useState<Tab | null>(null);

  return (
    <div>
      {/* Tab switch */}
      <div className="flex gap-1 mb-3 border-b border-zinc-200 dark:border-zinc-700">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
              tab === key
                ? "bg-white dark:bg-zinc-900 border border-b-white dark:border-zinc-700 dark:border-b-zinc-900 text-zinc-900 dark:text-zinc-100 -mb-px"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "faltantes"  && <PacientesFaltantes />}
      {tab === "cumpleanos" && <PacientesCumpleanos />}
      {tab === "consultas"  && <ConsultasRango />}
    </div>
  );
}
