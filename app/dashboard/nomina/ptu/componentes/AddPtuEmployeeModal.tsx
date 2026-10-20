"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, X } from "lucide-react";
import { useActionData } from "@/hooks/useActionData";
import { formatPeriodDate } from "@/lib/payroll/periodFormat";
import { addPtuDistributionEmployee, getPtuAddableEmployees } from "../actions";

interface Props {
  idPtuDistribution: number;
  fiscalYear: number;
  onClose: () => void;
}

const FIELD_CLASSES =
  "w-full rounded-lg border border-[#c4c6d0] dark:border-zinc-600 bg-white dark:bg-zinc-800 pl-9 pr-3 py-2 text-sm text-[#0b1c30] dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0051d5] focus:border-[#0051d5] transition-all";

/** Agrega a mano a quien trabajó en el ejercicio sin tener nómina fiscal en el sistema. Entra en ceros. */
export default function AddPtuEmployeeModal({ idPtuDistribution, fiscalYear, onClose }: Props) {
  const router = useRouter();
  const [searchText, setSearchText] = useState("");
  const [addingEmployeeId, setAddingEmployeeId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: addableEmployees, loading, error } = useActionData([idPtuDistribution], () =>
    getPtuAddableEmployees({ id_ptu_distribution: idPtuDistribution }),
  );

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const visibleEmployees = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    if (!addableEmployees || !normalizedSearch) return addableEmployees ?? [];
    return addableEmployees.filter(
      (employee) =>
        employee.nombre_completo.toLowerCase().includes(normalizedSearch) ||
        employee.codigo_empleado.toLowerCase().includes(normalizedSearch),
    );
  }, [addableEmployees, searchText]);

  async function handleAdd(idEmployee: number) {
    setAddingEmployeeId(idEmployee);
    setErrorMessage(null);
    try {
      const result = await addPtuDistributionEmployee({
        id_ptu_distribution: idPtuDistribution,
        id_empleado: idEmployee,
      });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setErrorMessage("Error inesperado al agregar al trabajador");
    } finally {
      setAddingEmployeeId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-ptu-employee-title"
        className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-xl bg-white dark:bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#c4c6d0] dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#0051d5]/10 text-[#0051d5] flex items-center justify-center">
              <UserPlus size={18} />
            </span>
            <h3 id="add-ptu-employee-title" className="text-lg font-semibold text-[#0b1c30] dark:text-zinc-50">
              Agregar trabajador
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-[#747780] hover:text-[#0b1c30] dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4 min-h-0">
          <p className="text-sm text-[#44474f] dark:text-zinc-400">
            Para quien trabajó en {fiscalYear} pero no tiene nómina fiscal en el sistema, por ejemplo antes de que
            existiera. Entra con 0 días y 0 de salario: edita la fila después para capturarlos.
          </p>

          {errorMessage && (
            <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          )}

          <div className="relative">
            <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747780]" />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Buscar por nombre o código"
              aria-label="Buscar empleado"
              className={FIELD_CLASSES}
            />
          </div>

          <div className="min-h-0 overflow-y-auto rounded-lg border border-[#c4c6d0] dark:border-zinc-700">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-[#747780] dark:text-zinc-500">Cargando empleados…</p>
            ) : error ? (
              <p role="alert" className="px-4 py-8 text-center text-sm text-[#ba1a1a] dark:text-red-400">
                {error}
              </p>
            ) : visibleEmployees.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#747780] dark:text-zinc-500">
                {searchText.trim()
                  ? "Ningún empleado coincide con la búsqueda."
                  : `No hay empleados por agregar: todos los que trabajaron en ${fiscalYear} ya están en el reparto.`}
              </p>
            ) : (
              <ul className="divide-y divide-[#c4c6d0]/50 dark:divide-zinc-700/50">
                {visibleEmployees.map((employee) => (
                  <li key={employee.id_empleado} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0b1c30] dark:text-zinc-100">
                        {employee.nombre_completo}
                      </p>
                      <p className="truncate text-xs text-[#747780] dark:text-zinc-500">
                        {employee.codigo_empleado} · {employee.nombre_sucursal} · ingresó el{" "}
                        {formatPeriodDate(employee.fecha_ingreso)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdd(employee.id_empleado)}
                      disabled={addingEmployeeId !== null}
                      className="shrink-0 rounded-lg border border-[#0051d5] px-3 py-1.5 text-sm font-semibold text-[#0051d5] hover:bg-[#0051d5]/10 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {addingEmployeeId === employee.id_empleado ? "Agregando…" : "Agregar"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
