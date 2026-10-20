"use client";

import { useCallback, useState } from "react";
import { History, Pencil, UserPlus } from "lucide-react";
import type { IPtuDistributionEmployee } from "@/interfaces/payroll_ptu";
import AddPtuEmployeeModal from "./AddPtuEmployeeModal";
import PtuEmployeeEditModal from "./PtuEmployeeEditModal";
import PtuHistoryModal from "./PtuHistoryModal";

export function AddPtuEmployeeButton({ idPtuDistribution, fiscalYear }: { idPtuDistribution: number; fiscalYear: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-[#0051d5] px-4 py-2 text-sm font-semibold text-[#0051d5] hover:bg-[#0051d5]/10 transition-colors"
      >
        <UserPlus size={16} />
        Agregar trabajador
      </button>
      {isOpen && (
        <AddPtuEmployeeModal idPtuDistribution={idPtuDistribution} fiscalYear={fiscalYear} onClose={closeModal} />
      )}
    </>
  );
}

export function EditPtuEmployeeButton({
  idPtuDistribution,
  employee,
}: {
  idPtuDistribution: number;
  employee: IPtuDistributionEmployee;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Editar días y salario"
        aria-label={`Editar la fila de ${employee.nombre_completo}`}
        className="p-1.5 rounded-lg text-[#44474f] dark:text-zinc-400 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
      >
        <Pencil size={16} />
      </button>
      {isOpen && (
        <PtuEmployeeEditModal idPtuDistribution={idPtuDistribution} employee={employee} onClose={closeModal} />
      )}
    </>
  );
}

export function PtuHistoryButton({
  idPtuDistribution,
  employee,
}: {
  idPtuDistribution: number;
  employee: IPtuDistributionEmployee;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="PTU de años anteriores"
        aria-label={`PTU de años anteriores de ${employee.nombre_completo}`}
        className="p-1.5 rounded-lg text-[#44474f] dark:text-zinc-400 hover:bg-[#eff4ff] dark:hover:bg-zinc-800 transition-colors"
      >
        <History size={16} />
      </button>
      {isOpen && (
        <PtuHistoryModal
          idPtuDistribution={idPtuDistribution}
          idEmployee={employee.id_empleado}
          employeeName={employee.nombre_completo}
          onClose={closeModal}
        />
      )}
    </>
  );
}
