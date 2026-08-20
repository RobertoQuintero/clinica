"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Power, PowerOff } from "lucide-react";
import { IEmployeeRecord } from "@/interfaces/employee";
import { setEmployeeActive, IEmployeeCatalogs } from "../../actions";
import EmployeeModal from "../../componentes/EmployeeModal";
import ConfirmModal from "@/app/dashboard/componentes/ConfirmModal";

interface Props {
  employee: IEmployeeRecord;
  catalogs: IEmployeeCatalogs;
}

export default function EmployeeActions({ employee, catalogs }: Props) {
  const router = useRouter();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [toggling, setToggling]           = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const handleToggleActive = async () => {
    setToggling(true);
    setError(null);
    try {
      const result = await setEmployeeActive(employee.id_empleado, !employee.activo);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setShowConfirm(false);
      router.refresh();
    } catch {
      setError("Error inesperado al cambiar el estatus");
    } finally {
      setToggling(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowEditModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm font-semibold text-[#0b1c30] dark:text-zinc-100 hover:bg-[#eff4ff] dark:hover:bg-zinc-700 transition-colors"
        >
          <Pencil size={16} />
          Editar
        </button>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className={
            employee.activo
              ? "flex items-center gap-2 px-4 py-2 rounded-lg border border-[#ba1a1a]/30 bg-[#ba1a1a]/10 text-sm font-semibold text-[#ba1a1a] hover:bg-[#ba1a1a]/20 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
              : "flex items-center gap-2 px-4 py-2 rounded-lg border border-[#009c6b]/30 bg-[#009c6b]/10 text-sm font-semibold text-[#009c6b] hover:bg-[#009c6b]/20 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30 transition-colors"
          }
        >
          {employee.activo ? <PowerOff size={16} /> : <Power size={16} />}
          {employee.activo ? "Desactivar" : "Activar"}
        </button>
      </div>

      {showEditModal && (
        <EmployeeModal employee={employee} catalogs={catalogs} onClose={() => setShowEditModal(false)} />
      )}

      {showConfirm && (
        <ConfirmModal
          message={
            employee.activo
              ? `¿Desactivar a ${employee.nombre_completo}? Podrás reactivarlo cuando quieras.`
              : `¿Activar a ${employee.nombre_completo}?`
          }
          confirmLabel={employee.activo ? "Desactivar" : "Activar"}
          loading={toggling}
          error={error}
          onConfirm={handleToggleActive}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
