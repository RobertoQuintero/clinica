"use client";

import { useCallback, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { IPtuDistribution } from "@/interfaces/payroll_ptu";
import PtuDistributionModal from "./PtuDistributionModal";

export function NewPtuDistributionButton() {
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
        Nuevo reparto de PTU
      </button>
      {isOpen && <PtuDistributionModal mode="create" onClose={closeModal} />}
    </>
  );
}

export function EditPtuDistributionButton({ distribution }: { distribution: IPtuDistribution }) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Editar parámetros"
        aria-label={`Editar parámetros del reparto ${distribution.ejercicio}`}
        className="p-1.5 rounded-lg text-[#44474f] dark:text-zinc-400 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
      >
        <Pencil size={16} />
      </button>
      {isOpen && <PtuDistributionModal mode="edit" distribution={distribution} onClose={closeModal} />}
    </>
  );
}
