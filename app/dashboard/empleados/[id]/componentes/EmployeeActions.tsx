"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Power, UserMinus } from "lucide-react";
import { IEmployeeRecord } from "@/interfaces/employee";
import type { ITerminationCause } from "@/interfaces/employee_termination";
import { setEmployeeActive, IEmployeeCatalogs } from "../../actions";
import EmployeeModal from "../../componentes/EmployeeModal";
import ConfirmModal from "@/app/dashboard/componentes/ConfirmModal";
import RegisterTerminationModal from "./RegisterTerminationModal";

interface Props {
  employee: IEmployeeRecord;
  catalogs: IEmployeeCatalogs;
  terminationCauses: ITerminationCause[];
}

const SECONDARY_BUTTON_CLASSES =
  "flex items-center gap-2 px-4 py-2 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 hover:bg-[#eff4ff] dark:hover:bg-zinc-700 transition-colors";
const DANGER_BUTTON_CLASSES =
  "flex items-center gap-2 px-4 py-2 rounded-lg border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 text-sm font-semibold text-[#ba1a1a] hover:bg-[#ba1a1a]/20 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors";
const SUCCESS_BUTTON_CLASSES =
  "flex items-center gap-2 px-4 py-2 rounded-lg border border-[#009c6b]/30 bg-[#009c6b]/10 text-sm font-semibold text-[#009c6b] hover:bg-[#009c6b]/20 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30 transition-colors";

export default function EmployeeActions({ employee, catalogs, terminationCauses }: Props) {
  const router = useRouter();
  const [showEditModal, setShowEditModal]               = useState(false);
  const [showTerminationModal, setShowTerminationModal] = useState(false);
  const [showActivateConfirm, setShowActivateConfirm]   = useState(false);
  const [activating, setActivating]                     = useState(false);
  const [error, setError]                               = useState<string | null>(null);

  const hasActiveTermination = employee.baja_vigente !== null;
  // Un inactivo sin baja registrada puede corregirse (Activar) o regularizarse (Registrar baja).
  const isInactiveWithoutTermination = !employee.activo && !hasActiveTermination;

  const handleActivate = async () => {
    setActivating(true);
    setError(null);
    try {
      const result = await setEmployeeActive(employee.id_empleado);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setShowActivateConfirm(false);
      router.refresh();
    } catch {
      setError("Error inesperado al activar al empleado");
    } finally {
      setActivating(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => setShowEditModal(true)} className={SECONDARY_BUTTON_CLASSES}>
          <Pencil size={16} />
          Editar
        </button>

        {(employee.activo || isInactiveWithoutTermination) && (
          <button type="button" onClick={() => setShowTerminationModal(true)} className={DANGER_BUTTON_CLASSES}>
            <UserMinus size={16} />
            {employee.activo ? "Dar de baja" : "Registrar baja"}
          </button>
        )}

        {isInactiveWithoutTermination && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setShowActivateConfirm(true);
            }}
            className={SUCCESS_BUTTON_CLASSES}
          >
            <Power size={16} />
            Activar
          </button>
        )}
      </div>

      {showEditModal && (
        <EmployeeModal employee={employee} catalogs={catalogs} onClose={() => setShowEditModal(false)} />
      )}

      {showTerminationModal && (
        <RegisterTerminationModal
          id_empleado={employee.id_empleado}
          employeeName={employee.nombre_completo}
          hireDate={employee.fecha_ingreso}
          isActive={employee.activo}
          causes={terminationCauses}
          onClose={() => setShowTerminationModal(false)}
        />
      )}

      {showActivateConfirm && (
        <ConfirmModal
          message={`¿Activar a ${employee.nombre_completo}?`}
          confirmLabel="Activar"
          loading={activating}
          error={error}
          onConfirm={handleActivate}
          onCancel={() => setShowActivateConfirm(false)}
        />
      )}
    </>
  );
}
