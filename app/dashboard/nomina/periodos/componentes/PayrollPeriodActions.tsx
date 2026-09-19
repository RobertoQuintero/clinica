"use client";

import { useCallback, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { IPayrollPeriodRow } from "@/interfaces/payroll_period";
import type { IPayrollFrequency } from "../actions";
import PayrollPeriodModal from "./PayrollPeriodModal";

export function NewPayrollPeriodButton({ frequencies }: { frequencies: IPayrollFrequency[] }) {
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
        Nuevo periodo de nómina
      </button>
      {isOpen && <PayrollPeriodModal mode="create" frequencies={frequencies} onClose={closeModal} />}
    </>
  );
}

export function EditPayrollPeriodButton({ period }: { period: IPayrollPeriodRow }) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Editar fechas"
        aria-label={`Editar fechas de ${period.codigo}`}
        className="p-1.5 rounded-lg text-[#44474f] dark:text-zinc-400 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
      >
        <Pencil size={16} />
      </button>
      {isOpen && <PayrollPeriodModal mode="edit" period={period} onClose={closeModal} />}
    </>
  );
}
